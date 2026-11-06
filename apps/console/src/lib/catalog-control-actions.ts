"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, type ActionResult } from "./action-error";
import { requireAnyConsoleSession, requireConsoleAccess } from "./guard";
import { serverSupabase } from "./supabase";

/** Controles del catálogo (Política 8 del manual de políticas de TI). La base de datos vuelve a exigir rol, plazos y datos. */

const paths = ["/coordinacion/catalogos", "/admin/control-catalogo", "/comercio", "/comercio/catalogo"];
const refresh = () => paths.forEach((path) => revalidatePath(path));

export async function reviewCatalogReport(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), confirmed: z.boolean(), note: z.string().trim().min(5, "Escribe lo que encontraste (mínimo 5 caracteres).").max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireAnyConsoleSession();
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("review_catalog_report", { p_id: parsed.data.id, p_confirmed: parsed.data.confirmed, p_note: parsed.data.note });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: parsed.data.confirmed ? "Confirmado. El comercio recibió el aviso y tiene 24 horas para corregir." : "Reporte descartado." };
}

export async function recordCatalogReview(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ notes: z.string().trim().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos." };
  await requireAnyConsoleSession();
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("record_catalog_review", parsed.data.notes ? { p_notes: parsed.data.notes } : {});
  if (error) return failure(error);
  refresh();
  const notified = Number((data as { notified?: number } | null)?.notified ?? 0);
  return { ok: true, message: notified === 0 ? "Revisión registrada: todos los catálogos están al día." : `Revisión registrada. Avisamos a ${notified} ${notified === 1 ? "comercio" : "comercios"}.` };
}

export async function recordCatalogMeasure(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ commerceId: z.string().uuid(), measure: z.string().trim().min(5, "Describe la medida (mínimo 5 caracteres).").max(300), note: z.string().trim().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("record_catalog_measure", { p_commerce: parsed.data.commerceId, p_measure: parsed.data.measure, ...(parsed.data.note ? { p_note: parsed.data.note } : {}) });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Medida registrada y comunicada al comercio." };
}

export async function markCatalogReportFixed(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), note: z.string().trim().min(5, "Cuéntanos qué corregiste (mínimo 5 caracteres).").max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("mark_catalog_report_fixed", { p_id: parsed.data.id, p_note: parsed.data.note });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Gracias. Quedó registrada la corrección." };
}
