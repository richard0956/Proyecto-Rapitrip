"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const money = z.number({ invalid_type_error: "monto inválido", required_error: "monto inválido" }).min(0, "no puede ser negativo").lt(100_000_000, "monto demasiado alto").multipleOf(0.01, "usa hasta dos decimales");
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Revisa los datos.";

function refresh() {
  revalidatePath("/caja");
}

export async function openCashSession(opening: number): Promise<ActionResult> {
  const parsed = money.safeParse(opening);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("open_cash_session", { p_opening: parsed.data });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export type CloseResult = { ok: true; expected: number; counted: number; difference: number } | { ok: false; error: string };

export async function closeCashSession(input: { counted: number; note?: string }): Promise<CloseResult> {
  const parsed = z.object({ counted: money, note: z.string().trim().max(200).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("close_cash_session", { p_counted: parsed.data.counted, p_note: parsed.data.note || undefined });
  if (error) return failure(error) as { ok: false; error: string };
  refresh();
  const result = data as { expected: number; counted: number; difference: number };
  return { ok: true, expected: Number(result.expected), counted: Number(result.counted), difference: Number(result.difference) };
}

const saleSchema = z.object({
  store: z.string().uuid(),
  method: z.enum(["efectivo", "tarjeta"]),
  items: z.array(z.object({ variant_id: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(30),
});

export async function createCounterSale(input: unknown): Promise<ActionResult> {
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("create_counter_sale", { p_store: parsed.data.store, p_items: parsed.data.items, p_payment_method: parsed.data.method });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function voidCounterSale(id: string, reason: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), reason: reasonSchema }).safeParse({ id, reason });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("void_counter_sale", { p_order: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}
