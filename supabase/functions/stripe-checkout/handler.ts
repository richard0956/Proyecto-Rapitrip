import { buildCheckoutParams, buildPurchaseCheckoutParams, StripeError, type Purchase, type stripeRequest } from "../_shared/stripe.ts";

/**
 * Cliente de Supabase reducido a lo que usa esta función (así se puede probar con uno de mentira).
 * `from` devuelve el constructor de consultas de supabase-js; no se tipa más para no depender de su forma interna.
 */
// deno-lint-ignore no-explicit-any
export type QueryClient = { from(table: string): any; rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export type Deps = {
  storeUrl: string;
  currency: string;
  /** Con la identidad de quien llama: lee solo lo suyo (RLS). */
  asCaller: QueryClient;
  /** Con la clave de servicio: registra la sesión y fija monto y moneda esperados. */
  admin: QueryClient;
  stripe: typeof stripeRequest;
};

export type Outcome = { status: number; body: unknown };

type OrderRow = { id: string; number: number; store_name: string; status: string; payment_method: string; delivery_fee: number | string; checkout_id: string | null };
type PurchaseOrderRow = { id: string; number: number; store_name: string; delivery_fee: number | string; delivery_class: string | null };
type ItemRow = { order_id?: string; product_name: string; variant_name: string; unit_price: number | string; quantity: number };
type CheckoutRow = { id: string; payment_method: string; payment_status: string };

/** Sesión de Stripe que ya se creó y ahora hay que vencer si no se puede registrar. */
async function expireSession(deps: Deps, id: string) {
  await deps.stripe("POST", `/v1/checkout/sessions/${id}/expire`, {}).catch(() => {});
}

async function createSession(deps: Deps, params: Record<string, string>): Promise<{ id: string; url: string } | null> {
  try {
    return await deps.stripe<{ id: string; url: string }>("POST", "/v1/checkout/sessions", params);
  } catch (e) {
    console.error("[stripe-checkout] crear sesión", e instanceof StripeError ? e.message : e);
    return null;
  }
}

/** Sesión de pago de un pedido suelto. */
export async function payOrder(deps: Deps, orderId: string): Promise<Outcome> {
  const { data: order } = (await deps.asCaller
    .from("orders_list")
    .select("id, number, store_name, status, payment_method, delivery_fee, checkout_id")
    .eq("id", orderId)
    .maybeSingle()) as { data: OrderRow | null };
  if (!order) return { status: 404, body: { error: "pedido no encontrado" } };
  if (order.payment_method !== "tarjeta" || order.status !== "pendiente_pago") {
    return { status: 409, body: { error: "el pedido no espera un pago con tarjeta" } };
  }
  if (order.checkout_id) {
    // Los pedidos de una compra pagada de una vez no se pagan por separado: se pagaría dos veces.
    const { data: checkout } = (await deps.asCaller.from("my_checkouts").select("id, payment_method, payment_status").eq("id", order.checkout_id).maybeSingle()) as { data: CheckoutRow | null };
    if (checkout && checkout.payment_status !== "no_aplica") {
      return { status: 409, body: { error: "este pedido se paga junto con su compra", checkout_id: order.checkout_id } };
    }
  }
  const { data: items } = (await deps.asCaller.from("order_items_list").select("product_name, variant_name, unit_price, quantity").eq("order_id", orderId)) as { data: ItemRow[] | null };
  if (!items || items.length === 0) return { status: 409, body: { error: "el pedido no tiene productos" } };

  const params = buildCheckoutParams(
    { id: order.id, number: order.number, storeName: order.store_name, deliveryFee: order.delivery_fee },
    items.map((i) => ({ productName: i.product_name, variantName: i.variant_name, unitPrice: i.unit_price, quantity: i.quantity })),
    { currency: deps.currency, storeUrl: deps.storeUrl },
  );
  const session = await createSession(deps, params);
  if (!session) return { status: 502, body: { error: "no se pudo iniciar el pago" } };

  const { data: recorded, error } = await deps.admin.rpc("record_order_checkout_session", { p_order: orderId, p_session: session.id, p_currency: deps.currency });
  if (error) {
    // El pedido dejó de esperar pago mientras tanto: la sesión recién creada no debe quedar abierta.
    await expireSession(deps, session.id);
    return { status: 409, body: { error: "el pedido ya no espera un pago" } };
  }
  const previous = (recorded as { previous_session?: string | null } | null)?.previous_session;
  if (previous) await expireSession(deps, previous);
  return { status: 200, body: { url: session.url, session_id: session.id } };
}

/** Sesión de pago de toda una compra (varios pedidos, un solo cobro). */
export async function payPurchase(deps: Deps, checkoutId: string): Promise<Outcome> {
  const { data: checkout } = (await deps.asCaller.from("my_checkouts").select("id, payment_method, payment_status").eq("id", checkoutId).maybeSingle()) as { data: CheckoutRow | null };
  if (!checkout) return { status: 404, body: { error: "compra no encontrada" } };
  if (checkout.payment_method !== "tarjeta" || checkout.payment_status !== "pendiente") {
    return { status: 409, body: { error: "la compra no espera un pago con tarjeta" } };
  }
  // Solo los pedidos que aún esperan pago entran en la sesión: la base de datos espera exactamente esa suma.
  const { data: orders } = (await deps.asCaller
    .from("orders_list")
    .select("id, number, store_name, delivery_fee, delivery_class")
    .eq("checkout_id", checkoutId)
    .eq("status", "pendiente_pago")
    .order("number")) as { data: PurchaseOrderRow[] | null };
  if (!orders || orders.length === 0) return { status: 409, body: { error: "la compra no tiene pedidos esperando pago" } };
  const { data: items } = (await deps.asCaller
    .from("order_items_list")
    .select("order_id, product_name, variant_name, unit_price, quantity")
    .in("order_id", orders.map((o) => o.id))) as { data: ItemRow[] | null };
  if (!items || items.length === 0) return { status: 409, body: { error: "la compra no tiene productos" } };

  const purchase: Purchase = {
    id: checkoutId,
    orders: orders.map((order) => ({
      id: order.id,
      number: order.number,
      storeName: order.store_name,
      deliveryClass: order.delivery_class,
      deliveryFee: order.delivery_fee,
      items: items
        .filter((item) => item.order_id === order.id)
        .map((i) => ({ productName: i.product_name, variantName: i.variant_name, unitPrice: i.unit_price, quantity: i.quantity })),
    })),
  };
  if (purchase.orders.some((order) => order.items.length === 0)) return { status: 409, body: { error: "un pedido de la compra no tiene productos" } };

  const session = await createSession(deps, buildPurchaseCheckoutParams(purchase, { currency: deps.currency, storeUrl: deps.storeUrl }));
  if (!session) return { status: 502, body: { error: "no se pudo iniciar el pago" } };

  const { data: recorded, error } = await deps.admin.rpc("record_checkout_payment_session", { p_checkout: checkoutId, p_session: session.id, p_currency: deps.currency });
  if (error) {
    // La compra dejó de esperar pago mientras tanto: la sesión recién creada no debe quedar abierta.
    await expireSession(deps, session.id);
    return { status: 409, body: { error: "la compra ya no espera un pago" } };
  }
  const previous = (recorded as { previous_session?: string | null } | null)?.previous_session;
  if (previous) await expireSession(deps, previous);
  return { status: 200, body: { url: session.url, session_id: session.id } };
}
