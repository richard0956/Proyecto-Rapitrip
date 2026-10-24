"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import type { DistanceResult } from "@/lib/order-route";
import { serverSupabase } from "@/lib/supabase";

const schema = z.object({
  id: z.string().uuid(),
  to: z.enum(["en_validacion", "confirmado", "preparando", "listo", "cancelado", "rechazado"]),
  reason: reasonSchema.optional(),
});

/** Mueve un pedido de estado. La base de datos decide si ese cambio le corresponde al comercio y exige motivo al rechazar o cancelar. */
export async function setOrderStatus(id: string, input: { to: string; reason?: string }): Promise<ActionResult> {
  const parsed = schema.safeParse({ id, to: input.to, reason: input.reason?.trim() ? input.reason : undefined });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_order_status", { p_order: parsed.data.id, p_to: parsed.data.to, p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/comercio");
  revalidatePath("/comercio/pedidos");
  return { ok: true };
}

/** Distancia aproximada (en línea recta) entre la tienda y el cliente. El comercio nunca recibe el punto del cliente, solo esta cifra. */
export async function orderDistance(id: string): Promise<DistanceResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("order_distance_km", { p_order: parsed.data });
  if (error) return { ok: false, error: "No pudimos calcular la distancia." };
  return { ok: true, km: data === null ? null : Number(data) };
}

/** Código de 4 dígitos que el comercio le muestra al repartidor para entregarle el pedido. Solo existe con el pedido listo. */
export async function pickupCode(id: string): Promise<{ ok: true; code: string | null } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("order_pickup_code", { p_order: parsed.data });
  if (error) return { ok: false, error: "No pudimos cargar el código de recogida." };
  return { ok: true, code: data ?? null };
}

/** Foto que tomó el repartidor al recoger el pedido (enlace firmado por 5 minutos). El comercio no ve la de entrega: muestra el domicilio del cliente. */
export async function pickupPhoto(id: string): Promise<{ ok: true; photo: { url: string | null; takenAt: string; purged: boolean } | null } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("order_evidence_list").select("file_path, taken_at, purged_at").eq("order_id", parsed.data).eq("kind", "recogida").maybeSingle();
  if (error) return { ok: false, error: "No pudimos cargar la foto de recogida." };
  if (!data?.taken_at) return { ok: true, photo: null };
  const signed = !data.purged_at && data.file_path ? await supabase.storage.from("entregas").createSignedUrl(data.file_path, 300) : null;
  return { ok: true, photo: { url: signed?.data?.signedUrl ?? null, takenAt: data.taken_at, purged: Boolean(data.purged_at) } };
}
