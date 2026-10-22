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
  to: z.enum(["confirmado", "preparando", "listo", "cancelado", "rechazado"]),
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
