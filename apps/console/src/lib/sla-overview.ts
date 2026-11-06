import { incidentSlaKind, isOverdue } from "./sla";
import type { serverSupabase } from "./supabase";

type Client = Awaited<ReturnType<typeof serverSupabase>>;

/** Cuántos plazos del manual de políticas de TI ya vencieron, por tipo. Lo que la sesión no puede leer cuenta como cero. */
export type OverdueSummary = { devoluciones: number; eliminaciones: number; incidentes: number; incidencias: number; avisos: number; reportes: number; medidas: number; revisionCatalogo: boolean; liquidaciones: number; conciliacion: string | null; efectivo: number; efectivoVencidas: number };

export async function overdueSummary(supabase: Client, { includeDeletions }: { includeDeletions: boolean }): Promise<OverdueSummary> {
  const now = new Date();
  const [returns, deletions, incidents, issues, reports, recurrences, catalogReview, settlements, reconciliations, cash] = await Promise.all([
    supabase.rpc("return_requests_for_admin"),
    includeDeletions ? supabase.rpc("list_deletion_requests") : Promise.resolve({ data: [] as { created_at: string }[], error: null }),
    supabase.from("it_incidents_list").select("type, severity, status, created_at, occurred_at, data_involved, affected, notified_at"),
    supabase.from("delivery_issues_list").select("created_at").eq("status", "abierta"),
    supabase.rpc("catalog_reports_for_ops"),
    supabase.rpc("catalog_recurrences"),
    supabase.rpc("catalog_review_status"),
    supabase.rpc("settlements_overview"),
    supabase.rpc("reconciliations"),
    supabase.rpc("cash_accountability_list", { p_status: "abierta" }),
  ]);
  for (const result of [returns, deletions, incidents, issues, reports, recurrences, catalogReview, settlements, reconciliations, cash]) if (result.error) console.error("[plazos]", result.error.message);
  // Control 9.1.1: el mes anterior (hora de Managua) debe quedar conciliado.
  const managua = new Date(now.getTime() - 6 * 3_600_000);
  const previousMonth = new Date(Date.UTC(managua.getUTCFullYear(), managua.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const reconciled = (reconciliations.data ?? []).some((row) => row.month === previousMonth);
  return {
    // Faltas de efectivo a nombre de un repartidor o cajero que esperan la medida de la administración (5 días hábiles).
    efectivo: (cash.data ?? []).length,
    efectivoVencidas: (cash.data ?? []).filter((row) => isOverdue("medida", row.created_at, now)).length,
    // Norma 9.1.3: comercios con pedidos por liquidar pasado el plazo de su convenio.
    liquidaciones: (settlements.data ?? []).filter((row) => (row.pending_orders > 0 || Number(row.pending_reversals) > 0) && row.due_at && new Date(row.due_at) <= now).length,
    conciliacion: reconciled || reconciliations.error ? null : previousMonth.slice(0, 7),
    // Política 8: reportes sin revisar en 24 horas, reincidencias sin medida en 5 días hábiles y la revisión semanal.
    reportes: (reports.data ?? []).filter((row) => row.status === "recibido" && isOverdue("reporte", row.created_at, now)).length,
    medidas: (recurrences.data ?? []).filter((row) => isOverdue("medida", row.flagged_at, now)).length,
    revisionCatalogo: Boolean((catalogReview.data as { overdue?: boolean } | null)?.overdue),
    devoluciones: (returns.data ?? []).filter((row) => row.status === "solicitada" && row.requested_at && isOverdue("devolucion", row.requested_at, now)).length,
    eliminaciones: (deletions.data ?? []).filter((row) => row.created_at && isOverdue("eliminacion", row.created_at, now)).length,
    // Norma 3.3.4: incidentes de seguridad que exponen datos y siguen sin aviso a los afectados pasadas 72 horas (aunque ya estén resueltos).
    avisos: (incidents.data ?? []).filter((row) => row.type === "seguridad" && (row.data_involved || row.affected) && !row.notified_at && row.created_at && isOverdue("aviso", row.occurred_at ?? row.created_at, now)).length,
    incidentes: (incidents.data ?? []).filter((row) => row.status !== "resuelto").filter((row) => {
      const kind = incidentSlaKind(row.type, row.severity);
      return kind && row.created_at ? isOverdue(kind, row.created_at, now) : false;
    }).length,
    incidencias: (issues.data ?? []).filter((row) => row.created_at && isOverdue("incidencia", row.created_at, now)).length,
  };
}
