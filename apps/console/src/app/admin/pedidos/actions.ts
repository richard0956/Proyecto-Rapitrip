"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

/** Cancelar un pedido abierto como excepción. La base de datos exige motivo, devuelve el stock y encola el reembolso si estaba pagado con tarjeta. */
export async function cancelOrder(id: string, reason: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), reason: reasonSchema }).safeParse({ id, reason });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_order_status", { p_order: parsed.data.id, p_to: "cancelado", p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/excepciones");
  return { ok: true };
}
