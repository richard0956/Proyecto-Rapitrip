"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { checkoutSchema } from "@rapitrip/validation";
import { z } from "zod";
import { expiredMessage } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

export type PlaceOrderResult =
  /** `payUrl`: página de Stripe cuando el método es tarjeta. Nulo si no hay que pagar o si no se pudo iniciar el pago (el pedido sigue esperándolo). */
  | { ok: true; orderId: string; payUrl: string | null; payError?: string }
  | { ok: false; error: string; expired?: boolean };

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
      if (body?.error && context.status === 409) message = "Este pedido ya no espera un pago.";
    }
    console.error("[checkout] stripe-checkout", error?.message);
    return { ok: false, error: message };
  }
  return { ok: true, url: String(data.url) };
}

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos de tu pedido." };
  const extra = extras.safeParse(input);
  await requireCustomer("/checkout");
  const supabase = await serverSupabase();
  const { store_id, items, payment_method, address, phone, notes, client_ref } = parsed.data;

  const { data: orderId, error } = await supabase.rpc("create_order", {
    p_store: store_id,
    p_items: items,
    p_payment_method: payment_method,
    p_address: address,
    p_phone: phone,
    p_notes: (notes ?? null) as string,
    p_client_ref: client_ref,
  });
  if (isSessionExpired(error)) return { ok: false, error: expiredMessage, expired: true };
  if (error || !orderId) {
    const result = failure(error);
    return { ok: false, error: result.ok ? "No se pudo crear el pedido." : result.error };
  }

  if (extra.success && extra.data.save_address_as) {
    // Extra de comodidad: un fallo (por ejemplo, el tope de 10 direcciones) no debe afectar al pedido ya creado.
    await supabase.rpc("save_address", { p_id: null as unknown as string, p_label: extra.data.save_address_as, p_address: address, p_phone: phone, p_make_default: false });
  }

  if (payment_method !== "tarjeta") return { ok: true, orderId, payUrl: null };
  const pay = await startCardPayment(orderId);
  return pay.ok ? { ok: true, orderId, payUrl: pay.url } : { ok: true, orderId, payUrl: null, payError: pay.error };
}
