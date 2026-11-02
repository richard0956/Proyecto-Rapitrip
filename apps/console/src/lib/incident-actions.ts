"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, type ActionResult } from "./action-error";
import { requireAnyConsoleSession } from "./guard";
import { reportingAreas, type ReportingArea } from "./incidents";
import { serverSupabase } from "./supabase";

/** Reporte de incidente de TI de caja, coordinación o comercio: llega a «Incidentes de TI» de la administración. */
export async function reportStaffIncident(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      type: z.enum(["seguridad", "interrupcion"]),
      severity: z.enum(["baja", "media", "alta"], { message: "Elige cuánto te afecta." }),
      where: z.string().trim().max(80).optional(),
      description: z.string().trim().min(10, "Describe el incidente con al menos 10 caracteres.").max(2000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { area } = await requireAnyConsoleSession();
  if (!reportingAreas.includes(area as ReportingArea)) return { ok: false, error: "La administración registra sus incidentes en «Incidentes de TI»." };
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("staff_report_incident", {
    p_type: parsed.data.type,
    p_severity: parsed.data.severity,
    p_description: parsed.data.description,
    ...(parsed.data.where ? { p_where: parsed.data.where } : {}),
  });
  if (error) return failure(error);
  revalidatePath(`/${area}/incidentes`);
  return { ok: true };
}
