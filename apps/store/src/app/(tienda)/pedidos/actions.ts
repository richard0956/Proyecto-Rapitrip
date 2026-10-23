"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

const reasonSchema = z.string().trim().min(5, "Cuéntanos el motivo (al menos 5 caracteres).").max(200, "El motivo admite hasta 200 caracteres.");

/** El cliente cancela su pedido mientras el comercio no lo haya aceptado. La base de datos vuelve a comprobar el estado y libera el stock. */
export async function cancelOrder(orderId: string, reason: string): Promise<CustomerResult> {
  if (!z.string().uuid().safeParse(orderId).success) return { ok: false, error: "Pedido inválido." };
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Indica el motivo." };
  await requireCustomer(`/pedidos/${orderId}`);
  const { error } = await (await serverSupabase()).rpc("set_order_status", { p_order: orderId, p_to: "cancelado", p_reason: parsed.data });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  return { ok: true, message: "Pedido cancelado." };
}

const returnSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(5, "Cuéntanos el motivo (entre 5 y 300 caracteres).").max(300, "El motivo admite hasta 300 caracteres."),
  photos: z.array(z.string().min(1)).min(1, "Adjunta al menos una foto.").max(5, "Puedes adjuntar hasta 5 fotos."),
});

/** El cliente pide la devolución de un pedido entregado con sus fotos ya subidas a su carpeta. Administración decide después. */
export async function requestReturn(orderId: string, reason: string, photos: string[]): Promise<CustomerResult> {
  const parsed = returnSchema.safeParse({ orderId, reason, photos });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa la solicitud." };
  await requireCustomer(`/pedidos/${orderId}`);
  const { error } = await (await serverSupabase()).rpc("request_return", { p_order: parsed.data.orderId, p_reason: parsed.data.reason, p_photos: parsed.data.photos });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath(`/pedidos/${orderId}`);
  return { ok: true, message: "Recibimos tu solicitud. Administración la revisará con tus fotos." };
}
