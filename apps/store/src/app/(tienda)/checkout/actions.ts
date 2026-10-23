"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { deliveryGroupQuoteSchema, purchaseSchema } from "@rapitrip/validation";
import { z } from "zod";
import type { GroupQuote } from "@/lib/delivery-class";
import { departmentOfPoint } from "@/lib/department";
import { expiredMessage } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

const extras = z.object({
  /** Guardar la dirección escrita en la libreta (D4). Es un extra: si falla, el pedido no se ve afectado. */
  save_address_as: z.string().trim().min(1).max(40).nullable().optional(),
});

/** Inicia el pago con tarjeta de un pedido propio. Lo usan el checkout y la pantalla del pedido (reintento). */
export async function startCardPayment(orderId: string): Promise<{ ok: true; url: string } | { ok: false; error: string; expired?: boolean }> {
  if (!z.string().uuid().safeParse(orderId).success) return { ok: false, error: "Pedido inválido." };
  await requireCustomer(`/pedidos/${orderId}`);
  const supabase = await serverSupabase();
  const { data, error } = await supabase.functions.invoke("stripe-checkout", { body: { order_id: orderId } });
  if (error || !data?.url) {
    let message = "No pudimos iniciar el pago. Inténtalo de nuevo desde tu pedido.";
    // La función responde con mensajes pensados para el cliente cuando el pedido ya no espera pago.
    const context = (error as { context?: Response } | null)?.context;
    if (context && typeof context.json === "function") {
      const body = await context.json().catch(() => null);
      if (context.status === 401) return { ok: false, error: expiredMessage, expired: true };
      if (body?.checkout_id && context.status === 409) message = "Este pedido se paga junto con el resto de tu compra.";
      else if (body?.error && context.status === 409) message = "Este pedido ya no espera un pago.";
    }
    console.error("[checkout] stripe-checkout", error?.message);
    return { ok: false, error: message };
  }
  return { ok: true, url: String(data.url) };
}

/** Inicia el pago con tarjeta de toda una compra (varios pedidos, una sola sesión de Stripe). Lo usan el checkout y la pantalla de la compra. */
export async function startCheckoutPayment(checkoutId: string): Promise<{ ok: true; url: string } | { ok: false; error: string; expired?: boolean }> {
  if (!z.string().uuid().safeParse(checkoutId).success) return { ok: false, error: "Compra inválida." };
  await requireCustomer(`/compras/${checkoutId}`);
  const supabase = await serverSupabase();
  const { data, error } = await supabase.functions.invoke("stripe-checkout", { body: { checkout_id: checkoutId } });
  if (error || !data?.url) {
    let message = "No pudimos iniciar el pago. Inténtalo de nuevo desde tu compra.";
    const context = (error as { context?: Response } | null)?.context;
    if (context && typeof context.json === "function") {
      if (context.status === 401) return { ok: false, error: expiredMessage, expired: true };
      if (context.status === 409) message = "Esta compra ya no espera un pago.";
    }
    console.error("[checkout] stripe-checkout (compra)", error?.message);
    return { ok: false, error: message };
  }
  return { ok: true, url: String(data.url) };
}

export type GroupQuoteResult =
  /** `quoteId`: cotización por ruta guardada en la base de datos (si la hubo); la compra la reutiliza para el mismo punto. */
  | ({ ok: true; quoteId: string | null } & GroupQuote)
  | { ok: false; error: string; expired?: boolean };

/**
 * Cotiza la entrega de una tienda: en cuántos envíos sale, de qué clase (express o programado), a qué precio y en cuántos días.
 * Si la tienda queda dentro de la cobertura express se pide antes la distancia por calle (`quote-delivery`); fuera de ella, o si
 * no responde, la base de datos cotiza con la distancia en línea recta. La decisión de clase y el monto son siempre de la base de datos.
 */
export async function quoteGroupAction(input: unknown): Promise<GroupQuoteResult> {
  const parsed = deliveryGroupQuoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa tu dirección de entrega." };
  await requireCustomer("/checkout");
  const supabase = await serverSupabase();
  const { store_id, items, latitude, longitude } = parsed.data;
  // El departamento sale del punto del mapa, no de lo que elija el cliente.
  const where = await departmentOfPoint(supabase, latitude, longitude, expiredMessage);
  if (!where.ok) return where;
  const department = where.department;

  let quoteId: string | null = null;
  const viaRoute = await supabase.functions.invoke("quote-delivery", { body: { store_id, latitude, longitude } });
  if (!viaRoute.error && viaRoute.data?.quote_id) quoteId = String(viaRoute.data.quote_id);
  else if ((viaRoute.error as { context?: Response } | null)?.context?.status === 401) return { ok: false, error: expiredMessage, expired: true };

  const call = (quote: string | null) =>
    supabase.rpc("quote_delivery_group", { p_store: store_id, p_items: items, p_latitude: latitude, p_longitude: longitude, p_department: department, ...(quote ? { p_quote_id: quote } : {}) });
  let { data, error } = await call(quoteId);
  // Si la cotización por ruta no sirve (venció, otro punto), se vuelve a cotizar sin ella en vez de fallar.
  if (error && quoteId) {
    quoteId = null;
    ({ data, error } = await call(null));
  }
  if (isSessionExpired(error)) return { ok: false, error: expiredMessage, expired: true };
  if (error || !data) {
    const result = failure(error);
    return { ok: false, error: result.ok ? "No pudimos calcular el envío." : result.error };
  }
  const group = data as unknown as GroupQuote;
  return { ok: true, quoteId, origin_department: group.origin_department ?? null, destination_department: group.destination_department ?? null, shipments: group.shipments ?? [] };
}

export type PlacedOrder = { order_id: string; number: number; store_id: string; store_name: string; delivery_class: "express" | "programado"; total: number; delivery_fee: number; eta_min_days: number | null; eta_max_days: number | null };

export type PlaceCheckoutResult =
  /** `payUrl`: página de Stripe cuando hay que pagar con tarjeta (una sola sesión para toda la compra). Nulo si no hay que pagar o no se pudo iniciar el pago: la compra sigue esperándolo. */
  | { ok: true; checkoutId: string; orders: PlacedOrder[]; payUrl: string | null; payError?: string }
  | { ok: false; error: string; expired?: boolean };

/** Crea la compra completa (un pedido por tienda y clase de entrega) en una sola operación: o se crean todos o ninguno. */
export async function placeCheckout(input: unknown): Promise<PlaceCheckoutResult> {
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos de tu compra." };
  const extra = extras.safeParse(input);
  await requireCustomer("/checkout");
  const supabase = await serverSupabase();
  const { groups, payment_method, address, phone, notes, client_ref, latitude, longitude } = parsed.data;
  const where = await departmentOfPoint(supabase, latitude, longitude, expiredMessage);
  if (!where.ok) return where;
  const department = where.department;

  const { data, error } = await supabase.rpc("create_checkout", {
    p_groups: groups.map((group) => ({ store_id: group.store_id, items: group.items, ...(group.quote_id ? { quote_id: group.quote_id } : {}) })),
    p_payment_method: payment_method,
    p_address: address,
    p_phone: phone,
    p_notes: (notes ?? null) as string,
    p_client_ref: client_ref,
    p_latitude: latitude,
    p_longitude: longitude,
    p_department: department,
  });
  if (isSessionExpired(error)) return { ok: false, error: expiredMessage, expired: true };
  if (error || !data) {
    const result = failure(error);
    return { ok: false, error: result.ok ? "No se pudo crear la compra." : result.error };
  }
  const placed = data as unknown as { checkout_id: string; payment_status: string; orders: PlacedOrder[] };

  if (extra.success && extra.data.save_address_as) {
    // Extra de comodidad: un fallo (por ejemplo, el tope de 10 direcciones) no debe afectar a la compra ya creada.
    const saved = await supabase.rpc("save_address", { p_id: null as unknown as string, p_label: extra.data.save_address_as, p_address: address, p_phone: phone, p_make_default: false, p_latitude: latitude, p_longitude: longitude });
    if (!saved.error && saved.data) await supabase.rpc("set_address_department", { p_id: saved.data, p_department: department });
  }

  const base = { ok: true as const, checkoutId: placed.checkout_id, orders: placed.orders };
  if (payment_method !== "tarjeta") return { ...base, payUrl: null };
  // Varios pedidos: una sola sesión para toda la compra. Un solo pedido: se paga el pedido, como siempre.
  const pay = placed.payment_status === "pendiente" ? await startCheckoutPayment(placed.checkout_id) : await startCardPayment(placed.orders[0]!.order_id);
  return pay.ok ? { ...base, payUrl: pay.url } : { ...base, payUrl: null, payError: pay.error };
}
