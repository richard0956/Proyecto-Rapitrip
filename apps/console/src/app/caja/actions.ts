"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { saleInputSchema, toSaleRpcArgs } from "@/lib/cash";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const money = z.number({ invalid_type_error: "monto inválido", required_error: "monto inválido" }).min(0, "no puede ser negativo").lt(100_000_000, "monto demasiado alto").multipleOf(0.01, "usa hasta dos decimales");
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Revisa los datos.";

function refresh() {
  revalidatePath("/caja");
}

/** Abre el turno en una caja física. Sin monto: el saldo inicial es lo contado en el último cierre de esa caja. */
export async function openCashSession(input: { opening: number | null; registerId: string | null }): Promise<ActionResult> {
  const parsed = z.object({ opening: money.nullable(), registerId: z.string().uuid().nullable() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("open_cash_session", {
    p_opening: parsed.data.opening as number,
    ...(parsed.data.registerId ? { p_register: parsed.data.registerId } : {}),
  });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export type CloseResult = { ok: true; expected: number; counted: number; difference: number; incidentsCount: number } | { ok: false; error: string };

export async function closeCashSession(input: { counted: number; note?: string }): Promise<CloseResult> {
  const parsed = z.object({ counted: money, note: z.string().trim().max(200).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("close_cash_session", { p_counted: parsed.data.counted, p_note: parsed.data.note || undefined });
  if (error) return failure(error) as { ok: false; error: string };
  refresh();
  const result = data as { expected: number; counted: number; difference: number; incidents_count: number };
  return { ok: true, expected: Number(result.expected), counted: Number(result.counted), difference: Number(result.difference), incidentsCount: Number(result.incidents_count) };
}

export async function createCounterSale(input: unknown): Promise<ActionResult> {
  const parsed = saleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos de la venta." };
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("create_counter_sale", toSaleRpcArgs(parsed.data));
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export type HandoffResult = { ok: true; status: "confirmada" | "con_diferencia"; declared: number; counted: number; difference: number } | { ok: false; error: string };

/** Confirma la entrega de efectivo de un repartidor con el monto que el cajero contó (sin ver lo declarado). */
export async function confirmCashHandoff(input: { id: string; counted: number; note?: string }): Promise<HandoffResult> {
  const parsed = z.object({ id: z.string().uuid(), counted: money, note: z.string().trim().max(200).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("confirm_cash_handoff", { p_handoff: parsed.data.id, p_counted: parsed.data.counted, ...(parsed.data.note ? { p_note: parsed.data.note } : {}) });
  if (error) return failure(error) as { ok: false; error: string };
  refresh();
  const result = data as { status: "confirmada" | "con_diferencia"; declared: number; counted: number; difference: number };
  return { ok: true, status: result.status, declared: Number(result.declared), counted: Number(result.counted), difference: Number(result.difference) };
}

/** «No lo recibí»: la entrega queda rechazada y el efectivo sigue a cargo del repartidor. */
export async function rejectCashHandoff(id: string, reason: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), reason: reasonSchema }).safeParse({ id, reason });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("reject_cash_handoff", { p_handoff: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export type CashIncident = { kind: string; detail: string; commerceName: string | null; orderNumber: number | null };

/** Incidencias de un turno, agrupables por comercio. La base de datos decide quién las ve. */
export async function loadCashIncidents(sessionId: string): Promise<{ ok: true; incidents: CashIncident[] } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(sessionId);
  if (!parsed.success) return { ok: false, error: "turno inválido" };
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("cash_session_incidents_for", { p_session: parsed.data });
  if (error) return failure(error) as { ok: false; error: string };
  return {
    ok: true,
    incidents: (data ?? []).map((row) => ({ kind: row.kind, detail: row.detail, commerceName: row.commerce_name, orderNumber: row.order_number === null ? null : Number(row.order_number) })),
  };
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

/** Devuelve al cliente el efectivo de una devolución aprobada. Sale del turno abierto del cajero. */
export async function returnCashToCustomer(requestId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(requestId);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("return_cash_to_customer", { p_request: parsed.data });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}
