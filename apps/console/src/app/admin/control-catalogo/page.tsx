import { Alert } from "@rapitrip/ui";
import { CatalogControl } from "@/components/catalog-control";
import { PageHeader } from "@/components/shell";
import { recordCatalogMeasure, recordCatalogReview, reviewCatalogReport } from "@/lib/catalog-control-actions";
import { requireConsoleAccess } from "@/lib/guard";
import { loadCatalogControl } from "@/lib/load-catalog-control";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Control de catálogos" };

/** La administración ve lo mismo que coordinación y, además, decide la medida ante una reincidencia (Control 8.2.1). */
export default async function ControlCatalogoPage() {
  await requireConsoleAccess("admin");
  const data = await loadCatalogControl(await serverSupabase(), { withRecurrences: true });
  return (
    <>
      <PageHeader title="Control de catálogos" description="Reportes de inconsistencias, revisión semanal de catálogos sin actualizar y reincidencias que esperan una medida (Política 8)." />
      {data.failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <CatalogControl {...data} actions={{ review: reviewCatalogReport, recordReview: recordCatalogReview, recordMeasure: recordCatalogMeasure }} />
    </>
  );
}
