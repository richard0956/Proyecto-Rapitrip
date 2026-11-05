"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

export async function reportIncident(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      type: z.enum(["seguridad", "interrupcion"]),
      severity: z.enum(["baja", "media", "alta"]),
      description: z.string().trim().min(5, "La descripción necesita al menos 5 caracteres.").max(2000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("report_incident", { p_type: parsed.data.type, p_severity: parsed.data.severity, p_description: parsed.data.description });
  if (error) return failure(error);
  revalidatePath("/admin/incidentes");
  return { ok: true };
}

/** Norma 3.3.4: deja constancia de que se avisó a los afectados de un incidente de seguridad (por qué medio y qué se les dijo). */
export async function recordIncidentNotice(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.string().uuid(), channel: z.string().trim().min(3, "Indica por qué medio avisaste.").max(120), note: z.string().trim().min(10, "Describe qué les informaste (mínimo 10 caracteres).").max(500) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("record_incident_notice", { p_incident: parsed.data.id, p_channel: parsed.data.channel, p_note: parsed.data.note });
  if (error) return failure(error);
  revalidatePath("/admin/incidentes");
  return { ok: true };
}

export async function setIncidentStatus(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["en_atencion", "resuelto"]), resolution: z.string().trim().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_incident_status", { p_id: parsed.data.id, p_status: parsed.data.status, p_resolution: parsed.data.resolution });
  if (error) return failure(error);
  revalidatePath("/admin/incidentes");
  return { ok: true };
}
