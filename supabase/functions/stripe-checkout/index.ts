import { createClient } from "npm:@supabase/supabase-js@2";
import { stripeRequest } from "../_shared/stripe.ts";
import { payOrder, payPurchase, type Deps } from "./handler.ts";

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

const uuid = /^[0-9a-f-]{36}$/i;

/**
 * Crea la sesión de pago de Stripe de un pedido suelto o de una compra completa. Los datos salen de la base de datos con la identidad
 * de quien llama (RLS: solo ve lo suyo); el navegador solo envía un id, nunca montos.
 * Una compra con tarjeta y varios pedidos se paga con UNA sesión (`checkout_id`); sus pedidos no abren sesión propia.
 * La lógica vive en `handler.ts` (se prueba con un cliente de mentira); aquí solo se valida la petición y se arman las dependencias.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "método no permitido" }, 405);
  if (!storeUrl) return reply(req, { error: "falta STORE_URL" }, 500);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply(req, { error: "no autenticado" }, 401);
  const body = await req.json().catch(() => null);
  const orderId = body?.order_id;
  const checkoutId = body?.checkout_id;
  const hasOrder = typeof orderId === "string" && uuid.test(orderId);
  const hasCheckout = typeof checkoutId === "string" && uuid.test(checkoutId);
  if (hasOrder === hasCheckout) return reply(req, { error: "indica un pedido o una compra" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const deps: Deps = {
    storeUrl,
    currency: (Deno.env.get("PAYMENT_CURRENCY") ?? "nio").toLowerCase(),
    asCaller: createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }),
    admin: createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
    stripe: stripeRequest,
  };
  const outcome = hasCheckout ? await payPurchase(deps, checkoutId) : await payOrder(deps, orderId);
  return reply(req, outcome.body, outcome.status);
});
