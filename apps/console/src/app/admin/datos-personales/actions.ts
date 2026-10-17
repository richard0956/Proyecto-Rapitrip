"use server";

import { exportRequestSchema, reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { invokeFunction } from "@/lib/functions";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

/** Los datos personales son del director; la base de datos exige además sesión de consola y deja la lectura auditada. */
async function requireDirector() {
  const session = await requireConsoleAccess("admin");
  return session.role === "superadmin";
}

const clientDetailSchema = z.object({ id: z.string(), full_name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable(), status: z.string(), created_at: z.string() });
export type ClientDetail = z.infer<typeof clientDetailSchema>;

export async function getClientDetail(input: unknown): Promise<{ ok: true; detail: ClientDetail } | { ok: false; error: string }> {
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(input);
  if (!parsed.success || !(await requireDirector())) return { ok: false, error: "No tienes permiso para esta acción." };
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("get_client_detail", { p_user: parsed.data.userId });
  if (error) return failure(error) as { ok: false; error: string };
  const detail = clientDetailSchema.safeParse(data);
  return detail.success ? { ok: true, detail: detail.data } : { ok: false, error: "No se pudo leer el detalle de la cuenta." };
}

export async function confirmAnonymization(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ userId: z.string().uuid(), reason: reasonSchema }).safeParse(input);
  if (!parsed.success) return invalidInput;
  if (!(await requireDirector())) return { ok: false, error: "No tienes permiso para esta acción." };
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("confirm_anonymization", { p_user: parsed.data.userId, p_reason: parsed.data.reason, p_holder_request: false });
  if (error) return failure(error);
  revalidatePath("/admin/datos-personales");
  return { ok: true };
}

export type ExportResult = { ok: true; url: string; passphrase: string; count: number } | { ok: false; error: string };

/** La frase de la exportación viaja en la respuesta y se muestra una sola vez; no se guarda en ningún lado. */
export async function requestExport(input: unknown): Promise<ExportResult> {
  const parsed = exportRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  if (!(await requireDirector())) return { ok: false, error: "No tienes permiso para esta acción." };
  const result = await invokeFunction<{ url: string; passphrase: string; count: number }>("export-data", parsed.data);
  return result.ok ? { ok: true, ...result.data } : result;
}
