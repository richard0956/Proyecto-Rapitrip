"use server";

import { stockChangeSchema, stockTrackingSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const idSchema = z.string().uuid();

function refresh() {
  revalidatePath("/comercio");
  revalidatePath("/comercio/inventario");
}

export async function setStockTracking(variantId: string, input: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(variantId);
  const parsed = stockTrackingSchema.safeParse(input);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_stock_tracking", { p_variant: parsedId.data, p_track: parsed.data.track, p_threshold: parsed.data.threshold });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

/** Entrada, salida o conteo físico: todos exigen motivo y quedan en el historial. */
export async function changeStock(variantId: string, input: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(variantId);
  const parsed = stockChangeSchema.safeParse(input);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const args = { p_variant: parsedId.data, p_reason: parsed.data.reason };
  const { error } =
    parsed.data.kind === "entrada"
      ? await supabase.rpc("add_stock", { ...args, p_amount: parsed.data.amount })
      : parsed.data.kind === "salida"
        ? await supabase.rpc("remove_stock", { ...args, p_amount: parsed.data.amount })
        : await supabase.rpc("count_stock", { ...args, p_quantity: parsed.data.amount });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}
