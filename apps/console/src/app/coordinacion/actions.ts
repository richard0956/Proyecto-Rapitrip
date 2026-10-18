"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

function refresh() {
  revalidatePath("/coordinacion");
}

/** Despachar, entregar o cancelar. La base de datos decide si ese cambio le toca a coordinación y exige repartidor para despachar. */
export async function setOrderStatus(id: string, input: { to: string; reason?: string }): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.string().uuid(), to: z.enum(["en_camino", "entregado", "cancelado"]), reason: reasonSchema.optional() })
    .safeParse({ id, to: input.to, reason: input.reason?.trim() ? input.reason : undefined });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_order_status", { p_order: parsed.data.id, p_to: parsed.data.to, p_reason: parsed.data.reason });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function assignCourier(id: string, courierId: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), courier: z.string().uuid() }).safeParse({ id, courier: courierId });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("assign_order_courier", { p_order: parsed.data.id, p_courier: parsed.data.courier });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}
