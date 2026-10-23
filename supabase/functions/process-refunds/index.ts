import { createClient } from "npm:@supabase/supabase-js@2";
import { refundPayment, StripeError } from "../_shared/stripe.ts";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Reembolsa en Stripe los pedidos pagados con tarjeta que se cancelaron o rechazaron (`reembolso_pendiente`): completo si el pedido
 * se pagó solo, o por su parte si se pagó junto con otros pedidos de la misma compra.
 * La dispara un programador (cada minuto) o la consola tras cancelar; se protege con el secreto compartido de tareas internas.
 * Es seguro reintentar: el reembolso usa una clave de idempotencia por pedido.
 */
Deno.serve(async (req) => {
  const secret = Deno.env.get("OUTBOX_SECRET");
  if (!secret || req.headers.get("x-outbox-secret") !== secret) return new Response("forbidden", { status: 403 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: rows, error } = await admin.rpc("claim_pending_refunds", { p_limit: 20 });
  if (error) return reply({ error: error.message }, 500);

  let refunded = 0;
  let failed = 0;
  for (const row of (rows ?? []) as { order_id: string; order_number: number; payment_intent_id: string; amount_cents: number | null }[]) {
    try {
      // `amount_cents` viene lleno cuando el pedido se pagó junto con otros: se devuelve solo su parte del cobro.
      const refund = await refundPayment(row.payment_intent_id, `refund-order-${row.order_id}`, `pedido ${row.order_number} cancelado`, row.amount_cents);
      const { error: markError } = await admin.rpc("mark_order_refunded", { p_order: row.order_id, p_refund: refund.id });
      if (markError) throw new Error(markError.message);
      refunded++;
    } catch (e) {
      console.error(`[process-refunds] pedido ${row.order_number}`, e instanceof StripeError ? e.message : e);
      failed++;
    }
  }
  return reply({ refunded, failed });
});
