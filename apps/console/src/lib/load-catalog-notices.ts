import type { CatalogNotice } from "@/components/catalog-notices";
import { formatDateTime } from "./format";
import type { serverSupabase } from "./supabase";

type Client = Awaited<ReturnType<typeof serverSupabase>>;

/** Avisos del catálogo del comercio en sesión: primero lo que espera corrección; los cerrados de más de 14 días no se muestran. */
export async function loadCatalogNotices(supabase: Client): Promise<CatalogNotice[]> {
  const { data, error } = await supabase.rpc("my_catalog_notices");
  if (error) console.error("[avisos-catalogo]", error.message);
  const recent = Date.now() - 14 * 86_400_000;
  return (data ?? [])
    .filter((n) => n.report_status === "confirmado" || new Date(n.created_at).getTime() > recent)
    .map((n) => ({
      id: n.id,
      kind: n.kind as CatalogNotice["kind"],
      message: n.message,
      createdAt: formatDateTime(n.created_at),
      reportId: n.report_id,
      reportStatus: n.report_status,
      fixDueIso: n.fix_due_at,
    }))
    .sort((a, b) => Number(b.reportStatus === "confirmado") - Number(a.reportStatus === "confirmado"));
}
