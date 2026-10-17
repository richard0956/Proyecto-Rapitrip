"use server";

import { masterItemSchema, reasonSchema } from "@rapitrip/validation";
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
