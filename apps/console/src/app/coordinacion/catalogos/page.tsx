import { Alert } from "@rapitrip/ui";
import { CatalogControl } from "@/components/catalog-control";
import { PageHeader } from "@/components/shell";
import { recordCatalogReview, reviewCatalogReport } from "@/lib/catalog-control-actions";
import { requireConsoleAccess } from "@/lib/guard";
import { loadCatalogControl } from "@/lib/load-catalog-control";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Control de catálogos" };

/** Coordinación (encargado de ventas) revisa los reportes de inconsistencias y hace la revisión semanal de catálogos. */
export default async function CatalogosPage() {
  await requireConsoleAccess("coordinacion");
  const data = await loadCatalogControl(await serverSupabase(), { withRecurrences: false });
  return (
    <>
      <PageHeader title="Control de catálogos" description="Reportes de clientes sobre productos que no coinciden y la revisión semanal de catálogos sin actualizar (Política 8)." />
      {data.failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <CatalogControl {...data} actions={{ review: reviewCatalogReport, recordReview: recordCatalogReview }} />
    </>
  );
}
