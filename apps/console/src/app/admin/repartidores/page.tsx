import { Alert } from "@rapitrip/ui";
import { CouriersBoard } from "@/components/couriers-board";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { loadCourierStats } from "@/lib/courier-data";
import { parsePeriod, periodOptions } from "@/lib/dashboard";
import { first, type SearchParams } from "@/lib/filters";
import { requireConsoleAccess } from "@/lib/guard";
import { createCourier } from "./actions";

export const metadata = { title: "Repartidores" };

const periodWord = { hoy: "hoy", "7d": "7 días", quincena: "esta quincena", mes: "este mes" } as const;

export default async function RepartidoresPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await requireConsoleAccess("admin");
  const period = parsePeriod(first(params.periodo));
  const { rows, failed } = await loadCourierStats(period);

  return (
    <>
      <PageHeader title="Repartidores" description="Quiénes entregan, cuánto han hecho y quiénes son los mejores. Entra a cada uno para ver su ficha y gestionarlo." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todos los repartidores. Recarga la página.</Alert> : null}
      <div className="mb-5">
        <FilterChips basePath="/admin/repartidores" param="periodo" current={period.key} options={periodOptions} />
      </div>
      <CouriersBoard rows={rows} basePath="/admin/repartidores" periodLabel={periodWord[period.key]} create={createCourier} />
    </>
  );
}
