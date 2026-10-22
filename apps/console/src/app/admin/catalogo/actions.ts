"use server";

import { deliveryLimitsSchema, masterItemSchema, reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const idSchema = z.string().uuid();
const nameSchema = masterItemSchema.shape.name;

export async function createMasterItem(input: unknown): Promise<ActionResult> {
  const parsed = masterItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("create_master_item", { p_kind: parsed.data.kind, p_name: parsed.data.name, p_parent: parsed.data.parent_id ?? undefined });
  if (error) return failure(error);
  revalidatePath("/admin/catalogo");
  return { ok: true };
}

export async function renameMasterItem(id: string, name: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsedName = nameSchema.safeParse(name);
  if (!parsedId.success) return invalidInput;
  if (!parsedName.success) return { ok: false, error: parsedName.error.issues[0]?.message ?? "Revisa el nombre." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("rename_master_item", { p_id: parsedId.data, p_name: parsedName.data });
  if (error) return failure(error);
  revalidatePath("/admin/catalogo");
  return { ok: true };
}

export async function setMasterItemStatus(id: string, input: { status: "activo" | "inactivo"; reason: string }): Promise<ActionResult> {
  const parsed = z.object({ id: idSchema, status: z.enum(["activo", "inactivo"]), reason: reasonSchema }).safeParse({ id, ...input });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_master_item_status", { p_id: parsed.data.id, p_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/admin/catalogo");
  return { ok: true };
}

/** Marca una categoría (y sus subcategorías) como «solo programado»: sus productos no pueden ser express. */
export async function setMasterItemProgramadoOnly(id: string, value: boolean): Promise<ActionResult> {
  const parsed = z.object({ id: idSchema, value: z.boolean() }).safeParse({ id, value });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_master_item_programado_only", { p_id: parsed.data.id, p_value: parsed.data.value });
  if (error) return failure(error);
  revalidatePath("/admin/catalogo");
  revalidatePath("/comercio/catalogo");
  return { ok: true };
}

/** Límites de peso y medidas de la entrega express. */
export async function setDeliveryLimits(input: unknown): Promise<ActionResult> {
  const parsed = deliveryLimitsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los límites." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_delivery_class_limits", {
    p_unit_kg: parsed.data.max_unit_kg,
    p_side_cm: parsed.data.max_side_cm,
    p_sum_cm: parsed.data.max_sum_cm,
    p_order_kg: parsed.data.max_order_kg,
  });
  if (error) return failure(error);
  revalidatePath("/admin/catalogo");
  revalidatePath("/comercio/catalogo");
  return { ok: true };
}
