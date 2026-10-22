// Utilidades de Stripe sin SDK: firma de webhooks, llamadas a la API y armado de la sesión de pago.

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante, para no filtrar por tiempos cuántos caracteres de la firma coinciden. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/**
 * Verifica la cabecera `Stripe-Signature` (`t=<segundos>,v1=<hmac>[,v1=...]`) contra el cuerpo CRUDO de la petición.
 * Rechaza firmas ajenas, cuerpos alterados y mensajes más viejos que la tolerancia (protege contra repeticiones).
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k?.trim() === "t") timestamp = v?.trim() ?? "";
    if (k?.trim() === "v1" && v) signatures.push(v.trim());
  }
  const t = Number(timestamp);
  if (!timestamp || !Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return signatures.some((signature) => safeEqual(signature, expected));
}

/** Firma un cuerpo como lo hace Stripe (para las pruebas y para simular eventos en local). */
export async function signStripePayload(payload: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  return `t=${nowSeconds},v1=${await hmacSha256Hex(secret, `${nowSeconds}.${payload}`)}`;
}

/** Los montos de la base de datos son decimales (NIO con dos decimales); Stripe pide enteros en centavos. */
export function toMinorUnits(amount: number | string): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error("monto inválido");
  return Math.round(value * 100);
}

export type CheckoutOrder = { id: string; number: number; storeName: string; deliveryFee: number | string };
export type CheckoutItem = { productName: string; variantName: string; unitPrice: number | string; quantity: number };

/** Parámetros de una sesión de Stripe Checkout para un pedido. Los renglones suman exactamente el total del pedido. */
export function buildCheckoutParams(order: CheckoutOrder, items: CheckoutItem[], opts: { currency: string; storeUrl: string; nowSeconds?: number }): Record<string, string> {
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    mode: "payment",
    client_reference_id: order.id,
    "metadata[order_id]": order.id,
    "payment_intent_data[metadata][order_id]": order.id,
    "payment_intent_data[description]": `Pedido ${order.number} · ${order.storeName}`.slice(0, 200),
    success_url: `${opts.storeUrl}/pedidos/${order.id}?pago=ok`,
    cancel_url: `${opts.storeUrl}/pedidos/${order.id}?pago=cancelado`,
    // Stripe exige que la sesión dure al menos 30 minutos; un pago tardío se reembolsa solo (ver apply_stripe_event).
    expires_at: String(now + 31 * 60),
    locale: "es",
  };
  let index = 0;
  const line = (name: string, unitAmount: number, quantity: number) => {
    params[`line_items[${index}][quantity]`] = String(quantity);
    params[`line_items[${index}][price_data][currency]`] = opts.currency.toLowerCase();
    params[`line_items[${index}][price_data][unit_amount]`] = String(unitAmount);
    params[`line_items[${index}][price_data][product_data][name]`] = name.slice(0, 250);
    index++;
  };
  for (const item of items) line(`${item.productName} · ${item.variantName}`, toMinorUnits(item.unitPrice), item.quantity);
  const fee = toMinorUnits(order.deliveryFee);
  if (fee > 0) line("Envío", fee, 1);
  return params;
}

export type PurchaseOrder = { id: string; number: number; storeName: string; deliveryClass?: string | null; deliveryFee: number | string; items: CheckoutItem[] };
export type Purchase = { id: string; orders: PurchaseOrder[] };

/**
 * Parámetros de UNA sesión de Stripe Checkout para toda una compra (varios pedidos). Los renglones suman exactamente la suma
 * de los totales de los pedidos: los productos de cada uno y su envío como renglón aparte. La sesión se identifica por la compra.
 */
export function buildPurchaseCheckoutParams(purchase: Purchase, opts: { currency: string; storeUrl: string; nowSeconds?: number }): Record<string, string> {
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const numbers = purchase.orders.map((order) => order.number).join(", ");
  const params: Record<string, string> = {
    mode: "payment",
    client_reference_id: purchase.id,
    "metadata[checkout_id]": purchase.id,
    "payment_intent_data[metadata][checkout_id]": purchase.id,
    "payment_intent_data[description]": `Compra · pedidos ${numbers}`.slice(0, 200),
    success_url: `${opts.storeUrl}/compras/${purchase.id}?pago=ok`,
    cancel_url: `${opts.storeUrl}/compras/${purchase.id}?pago=cancelado`,
    // Stripe exige que la sesión dure al menos 30 minutos; un pago tardío se reembolsa solo (ver apply_stripe_checkout_event).
    expires_at: String(now + 31 * 60),
    locale: "es",
  };
  let index = 0;
  const line = (name: string, unitAmount: number, quantity: number) => {
    params[`line_items[${index}][quantity]`] = String(quantity);
    params[`line_items[${index}][price_data][currency]`] = opts.currency.toLowerCase();
    params[`line_items[${index}][price_data][unit_amount]`] = String(unitAmount);
    params[`line_items[${index}][price_data][product_data][name]`] = name.slice(0, 250);
    index++;
  };
  for (const order of purchase.orders) {
    for (const item of order.items) line(`${item.productName} · ${item.variantName} (${order.storeName})`, toMinorUnits(item.unitPrice), item.quantity);
    const fee = toMinorUnits(order.deliveryFee);
    if (fee > 0) line(`Envío ${order.deliveryClass === "programado" ? "programado" : "express"} · ${order.storeName}`, fee, 1);
  }
  return params;
}

/** Total de una compra en centavos, igual a lo que la base de datos espera (la suma de los pedidos que esperan pago). */
export function purchaseTotalMinorUnits(purchase: Purchase): number {
  return purchase.orders.reduce(
    (sum, order) => sum + order.items.reduce((s, item) => s + toMinorUnits(item.unitPrice) * item.quantity, 0) + toMinorUnits(order.deliveryFee),
    0,
  );
}

/** A qué pertenece un evento de Stripe: a una compra (pagada de una vez) o a un pedido suelto. */
export function stripeEventTarget(object: { client_reference_id?: unknown; metadata?: Record<string, string> | null }): { kind: "checkout" | "order"; id: string } | null {
  const uuid = /^[0-9a-f-]{36}$/i;
  const checkout = object.metadata?.checkout_id;
  if (typeof checkout === "string" && uuid.test(checkout)) return { kind: "checkout", id: checkout };
  const order = (object.client_reference_id as string | undefined) ?? object.metadata?.order_id;
  if (typeof order === "string" && uuid.test(order)) return { kind: "order", id: order };
  return null;
}

const API = "https://api.stripe.com";

export class StripeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Llamada a la API de Stripe con cuerpo de formulario. `idempotencyKey` evita duplicar cobros o reembolsos al reintentar. */
export async function stripeRequest<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, string>,
  opts: { idempotencyKey?: string; secretKey?: string } = {},
): Promise<T> {
  const key = opts.secretKey ?? Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new StripeError(500, "falta STRIPE_SECRET_KEY");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  let body: string | undefined;
  if (params && method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(params).toString();
  }
  const response = await fetch(`${API}${path}`, { method, headers, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new StripeError(response.status, data?.error?.message ?? `Stripe respondió ${response.status}`);
  return data as T;
}

/** Parámetros de un reembolso: completo, o parcial si se indica el monto en centavos (varios pedidos comparten un cobro). */
export function refundParams(paymentIntent: string, reason: string, amountCents?: number | null): Record<string, string> {
  const params: Record<string, string> = { payment_intent: paymentIntent, "metadata[motivo]": reason.slice(0, 200) };
  if (amountCents !== undefined && amountCents !== null) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("monto de reembolso inválido");
    params.amount = String(amountCents);
  }
  return params;
}

/** Reembolso de un pago, completo o parcial. La clave de idempotencia evita devolver dos veces si el webhook o el programador se reintentan. */
export function refundPayment(paymentIntent: string, idempotencyKey: string, reason: string, amountCents?: number | null) {
  return stripeRequest<{ id: string }>("POST", "/v1/refunds", refundParams(paymentIntent, reason, amountCents), { idempotencyKey });
}
