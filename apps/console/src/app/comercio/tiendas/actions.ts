"use server";

import { reasonSchema, storeExceptionSchema, storeHoursSchema, storeSchema, temporaryClosureSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { storeLocalToIso } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";

const idSchema = z.string().uuid();
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Revisa los datos.";

function refresh(id?: string) {
  revalidatePath("/comercio");
  revalidatePath("/comercio/tiendas");
  if (id) revalidatePath(`/comercio/tiendas/${id}`);
}

/** El comercio de la cuenta sale de su rol; la base de datos vuelve a comprobarlo en la función. */
async function ownCommerceId() {
  const supabase = await serverSupabase();
  const { data } = await supabase.from("my_roles").select("commerce_id").eq("role", "comercio").eq("status", "activo").maybeSingle();
  return { supabase, commerceId: data?.commerce_id ?? null };
}

export type CreateStoreResult = { ok: true; id: string } | { ok: false; error: string };

export async function createStore(input: unknown): Promise<CreateStoreResult> {
  const parsed = storeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const { supabase, commerceId } = await ownCommerceId();
  if (!commerceId) return { ok: false, error: "Tu cuenta no tiene un comercio activo." };
  const { data, error } = await supabase.rpc("create_store", { p_commerce: commerceId, p_name: parsed.data.name, p_address: parsed.data.address ?? undefined, p_phone: parsed.data.phone ?? undefined });
  if (error) return failure(error) as { ok: false; error: string };
  refresh();
  return { ok: true, id: data };
}

export async function updateStore(id: string, input: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = storeSchema.safeParse(input);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("update_store", { p_store: parsedId.data, p_name: parsed.data.name, p_address: parsed.data.address ?? undefined, p_phone: parsed.data.phone ?? undefined });
  if (error) return failure(error);
  refresh(parsedId.data);
  return { ok: true };
}

export async function setStoreStatus(id: string, input: { status: "activa" | "inactiva"; reason: string }): Promise<ActionResult> {
  const parsed = z.object({ id: idSchema, status: z.enum(["activa", "inactiva"]), reason: reasonSchema }).safeParse({ id, ...input });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_store_status", { p_store: parsed.data.id, p_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return failure(error);
  refresh(parsed.data.id);
  return { ok: true };
}

export async function saveStoreHours(id: string, hours: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = storeHoursSchema.safeParse(hours);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_store_hours", { p_store: parsedId.data, p_hours: parsed.data });
  if (error) return failure(error);
  refresh(parsedId.data);
  return { ok: true };
}

export async function closeStoreTemporarily(id: string, input: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = temporaryClosureSchema.safeParse(input);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("close_store_temporarily", { p_store: parsedId.data, p_until: storeLocalToIso(parsed.data.until), p_reason: parsed.data.reason ?? undefined });
  if (error) return failure(error);
  refresh(parsedId.data);
  return { ok: true };
}

export async function reopenStore(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalidInput;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("reopen_store", { p_store: parsedId.data });
  if (error) return failure(error);
  refresh(parsedId.data);
  return { ok: true };
}

export async function saveStoreException(id: string, input: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = storeExceptionSchema.safeParse(input);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_store_exception", {
    p_store: parsedId.data,
    p_date: parsed.data.on_date,
    p_closed: parsed.data.closed,
    p_opens: parsed.data.opens ?? undefined,
    p_closes: parsed.data.closes ?? undefined,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return failure(error);
  refresh(parsedId.data);
  return { ok: true };
}

export async function deleteStoreException(id: string, date: string): Promise<ActionResult> {
  const parsed = z.object({ id: idSchema, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse({ id, date });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("delete_store_exception", { p_store: parsed.data.id, p_date: parsed.data.date });
  if (error) return failure(error);
  refresh(parsed.data.id);
  return { ok: true };
}
