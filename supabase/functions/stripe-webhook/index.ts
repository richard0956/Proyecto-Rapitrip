import { createClient } from "npm:@supabase/supabase-js@2";
import { refundPayment, StripeError, stripeEventTarget, verifyStripeSignature } from "../_shared/stripe.ts";

const HANDLED = new Set(["checkout.session.completed", "checkout.session.expired"]);

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> & { metadata?: Record<string, string> } };
};

/**
 * Webhook de Stripe. Se despliega sin verificación JWT: la autenticidad la da la firma `Stripe-Signature`.
 * Responde 2xx cuando el evento quedó atendido (incluso si se ignora) y 5xx cuando Stripe debe reintentar.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "método no permitido" }, 405);
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return reply({ error: "falta STRIPE_WEBHOOK_SECRET" }, 500);

  // El cuerpo CRUDO: la firma se calcula sobre los bytes exactos, no sobre el JSON reserializado.
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret))) {
    return reply({ error: "firma inválida" }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return reply({ error: "cuerpo inválido" }, 400);
  }
  if (!HANDLED.has(event.type)) return reply({ received: true, ignored: event.type });

  const object = event.data?.object ?? {};
  // Una compra pagada de una vez lleva `metadata.checkout_id`; un pedido suelto, `client_reference_id` (o `metadata.order_id`).
  const target = stripeEventTarget(object);
  if (!target) return reply({ received: true, ignored: "sin pedido" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const common = {
    p_event_id: event.id,
    p_type: event.type,
    p_session: (object.id as string | undefined) ?? null,
    p_intent: (object.payment_intent as string | undefined) ?? null,
    p_amount: typeof object.amount_total === "number" ? object.amount_total : null,
    p_currency: (object.currency as string | undefined) ?? null,
    p_paid: object.payment_status === "paid",
  };
  const { data, error } =
    target.kind === "checkout"
      ? await admin.rpc("apply_stripe_checkout_event", { ...common, p_checkout: target.id })
      : await admin.rpc("apply_stripe_event", { ...common, p_order: target.id });
  if (error) {
    console.error(`[stripe-webhook] ${target.kind === "checkout" ? "apply_stripe_checkout_event" : "apply_stripe_event"}`, error.message);
    return reply({ error: "no se pudo registrar el evento" }, 500);
  }

  // `duplicado:<resultado>`: el evento ya se atendió, pero si faltó el reembolso se reintenta (la clave de idempotencia lo hace seguro).
  const outcome = String(data).replace(/^duplicado:/, "");
  if (outcome.startsWith("reembolsar")) {
    const intent = object.payment_intent;
    if (typeof intent !== "string") return reply({ received: true, outcome, warning: "sin payment_intent" });
    try {
      await refundPayment(intent, `refund-${event.id}`, outcome);
      await admin.rpc("set_payment_event_outcome", { p_event_id: event.id, p_outcome: outcome.replace("reembolsar", "reembolsado") });
    } catch (e) {
      // Sin reembolso no se confirma: Stripe reintenta el evento y se vuelve a intentar.
      console.error("[stripe-webhook] reembolso", e instanceof StripeError ? e.message : e);
      return reply({ error: "no se pudo reembolsar" }, 500);
    }
  }
  return reply({ received: true, outcome });
});
