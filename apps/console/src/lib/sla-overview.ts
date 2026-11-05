import { incidentSlaKind, isOverdue } from "./sla";
import type { serverSupabase } from "./supabase";

type Client = Awaited<ReturnType<typeof serverSupabase>>;

/** Cuántos plazos del manual de políticas de TI ya vencieron, por tipo. Lo que la sesión no puede leer cuenta como cero. */
export type OverdueSummary = { devoluciones: number; eliminaciones: number; incidentes: number; incidencias: number };

export async function overdueSummary(supabase: Client, { includeDeletions }: { includeDeletions: boolean }): Promise<OverdueSummary> {
  const now = new Date();
  const [returns, deletions, incidents, issues] = await Promise.all([
    supabase.rpc("return_requests_for_admin"),
    includeDeletions ? supabase.rpc("list_deletion_requests") : Promise.resolve({ data: [] as { created_at: string }[], error: null }),
    supabase.from("it_incidents_list").select("type, severity, created_at").neq("status", "resuelto"),
    supabase.from("delivery_issues_list").select("created_at").eq("status", "abierta"),
  ]);
  for (const result of [returns, deletions, incidents, issues]) if (result.error) console.error("[plazos]", result.error.message);
  return {
    devoluciones: (returns.data ?? []).filter((row) => row.status === "solicitada" && row.requested_at && isOverdue("devolucion", row.requested_at, now)).length,
    eliminaciones: (deletions.data ?? []).filter((row) => row.created_at && isOverdue("eliminacion", row.created_at, now)).length,
    incidentes: (incidents.data ?? []).filter((row) => {
      const kind = incidentSlaKind(row.type, row.severity);
      return kind && row.created_at ? isOverdue(kind, row.created_at, now) : false;
    }).length,
    incidencias: (issues.data ?? []).filter((row) => row.created_at && isOverdue("incidencia", row.created_at, now)).length,
  };
}
