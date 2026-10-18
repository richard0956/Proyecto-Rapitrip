import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCheckoutParams, stripeRequest, StripeError } from "../_shared/stripe.ts";

const storeUrl = (Deno.env.get("STORE_URL") ?? "").replace(/\/$/, "");

// La tienda llama a esta función desde el navegador: solo se acepta su origen.
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && origin === storeUrl ? origin : storeUrl || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const reply = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

type OrderRow = { id: string; number: number; store_name: string; status: string; payment_method: string; delivery_fee: number | string };
type ItemRow = { product_name: string; variant_name: string; unit_price: number | string; quantity: number };

/**
 * Crea la sesión de pago de Stripe de un pedido propio. Los datos del pedido salen de la base de datos con la identidad de quien llama
 * (RLS: solo ve sus pedidos); el navegador solo envía el id, nunca montos.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "método no permitido" }, 405);
  if (!storeUrl) return reply(req, { error: "falta STORE_URL" }, 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply(req, { error: "no autenticado" }, 401);
  const body = await req.json().catch(() => null);
  const orderId = body?.order_id;
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) return reply(req, { error: "pedido inválido" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: order } = await asCaller
    .from("orders_list")
    .select("id, number, store_name, status, payment_method, delivery_fee")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();
  if (!order) return reply(req, { error: "pedido no encontrado" }, 404);
  if (order.payment_method !== "tarjeta" || order.status !== "pendiente_pago") {
    return reply(req, { error: "el pedido no espera un pago con tarjeta" }, 409);
  }
  const { data: items } = await asCaller
    .from("order_items_list")
    .select("product_name, variant_name, unit_price, quantity")
    .eq("order_id", orderId)
    .returns<ItemRow[]>();
  if (!items || items.length === 0) return reply(req, { error: "el pedido no tiene productos" }, 409);

  const currency = (Deno.env.get("PAYMENT_CURRENCY") ?? "nio").toLowerCase();
  const params = buildCheckoutParams(
    { id: order.id, number: order.number, storeName: order.store_name, deliveryFee: order.delivery_fee },
    items.map((i) => ({ productName: i.product_name, variantName: i.variant_name, unitPrice: i.unit_price, quantity: i.quantity })),
    { currency, storeUrl },
  );

  let session: { id: string; url: string };
  try {
    session = await stripeRequest<{ id: string; url: string }>("POST", "/v1/checkout/sessions", params);
  } catch (e) {
    console.error("[stripe-checkout] crear sesión", e instanceof StripeError ? e.message : e);
    return reply(req, { error: "no se pudo iniciar el pago" }, 502);
  }

  // Se registra con la clave de servicio: fija monto y moneda esperados y devuelve la sesión anterior para vencerla.
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: recorded, error } = await admin.rpc("record_order_checkout_session", { p_order: orderId, p_session: session.id, p_currency: currency });
  if (error) {
    // El pedido dejó de esperar pago mientras tanto: la sesión recién creada no debe quedar abierta.
    await stripeRequest("POST", `/v1/checkout/sessions/${session.id}/expire`, {}).catch(() => {});
    return reply(req, { error: "el pedido ya no espera un pago" }, 409);
  }
  const previous = (recorded as { previous_session?: string | null } | null)?.previous_session;
  if (previous) await stripeRequest("POST", `/v1/checkout/sessions/${previous}/expire`, {}).catch(() => {});

  return reply(req, { url: session.url, session_id: session.id });
});
