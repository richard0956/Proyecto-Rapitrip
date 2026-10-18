"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
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
