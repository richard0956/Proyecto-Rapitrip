import { Alert, Card, CardHeader, HBarList, KpiCard, LineChart } from "@rapitrip/ui";
import { Banknote, ShoppingBag, Store, Trophy } from "lucide-react";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { compactMoney, fillDays, firstDays, parsePeriod, periodOptions, trendOf } from "@/lib/dashboard";
import { first, type SearchParams } from "@/lib/filters";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { serverSupabase } from "@/lib/supabase";
import { createStore } from "./actions";
import { StoresWorkspace, type StoreRow } from "./stores-workspace";

export const metadata = { title: "Mis tiendas" };

const periodWord = { hoy: "hoy", "7d": "los últimos 7 días", quincena: "esta quincena", mes: "este mes" } as const;
const vsWord = { hoy: "ayer", "7d": "los 7 días anteriores", quincena: "la quincena anterior", mes: "el mes anterior" } as const;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export default async function TiendasPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await requireConsoleAccess("comercio");
  const period = parsePeriod(first(params.periodo));
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("stores_list").select("id, name, address, status, closed_until, open_now, hour_ranges, latitude").order("name");
  if (error) console.error("[tiendas]", error.message);

  const list = (data ?? []).flatMap((row) => (row.id && row.name ? [row] : []));
  const single = list.length === 1 ? (list[0]?.id ?? undefined) : undefined;
  const [byStore, top, current, previous] = await Promise.all([
    supabase.rpc("sales_by_store", { p_from: period.from, p_to: period.to }),
    supabase.rpc("store_top_products", { p_from: period.from, p_to: period.to, p_per_store: 3 }),
    supabase.rpc("sales_by_day", { p_from: period.from, p_to: period.to, p_store: single }),
    supabase.rpc("sales_by_day", { p_from: period.prevFrom, p_to: period.prevTo, p_store: single }),
  ]);
  const errors = [byStore, top, current, previous].flatMap((result) => (result.error ? [result.error.message] : []));
  if (errors.length > 0) console.error("[tiendas:cifras]", errors.join(" | "));

  const salesByStore = new Map((byStore.data ?? []).flatMap((row) => (row.store_id ? [[row.store_id, { sales: Number(row.sales), orders: Number(row.orders) }] as const] : [])));
  const topByStore = new Map<string, { name: string; units: number }[]>();
  for (const row of top.data ?? []) {
    if (!row.store_id || !row.product_name) continue;
    const entries = topByStore.get(row.store_id) ?? [];
    entries.push({ name: row.product_name, units: Number(row.units) });
    topByStore.set(row.store_id, entries);
  }

  const rows: StoreRow[] = list.map((row) => ({
    id: row.id!,
    name: row.name!,
    address: row.address,
    status: row.status,
    closed_until: row.closed_until,
    open_now: row.open_now,
    hour_ranges: Number(row.hour_ranges ?? 0),
    located: row.latitude !== null,
    metrics: { sales: salesByStore.get(row.id!)?.sales ?? 0, orders: salesByStore.get(row.id!)?.orders ?? 0, topProducts: topByStore.get(row.id!) ?? [] },
  }));

  const totalSales = sum(rows.map((row) => row.metrics?.sales ?? 0));
  const totalOrders = sum(rows.map((row) => row.metrics?.orders ?? 0));
  const leader = [...rows].sort((a, b) => (b.metrics?.sales ?? 0) - (a.metrics?.sales ?? 0))[0];
  const word = periodWord[period.key];
  const vs = vsWord[period.key];

  // Con una sola tienda se grafica lo vendido día a día contra el periodo anterior; con varias, se comparan entre sí.
  const todayEnd = parsePeriod("hoy").to;
  const upTo = period.to < todayEnd ? period.to : todayEnd;
  const labels = fillDays([], period.from, period.to).map((point) => point.day.slice(8));
  const currentRows = current.data ?? [];
  const previousRows = previous.data ?? [];
  const currentSeries = fillDays(currentRows.map((row) => ({ day: row.day, value: Number(row.sales) })), period.from, upTo);
  const previousSeries = fillDays(previousRows.map((row) => ({ day: row.day, value: Number(row.sales) })), period.prevFrom, period.from).slice(0, labels.length);
  const comparable = firstDays(previousRows, period.prevFrom, currentSeries.length);
  const trend = trendOf(totalSales, sum(comparable.map((row) => Number(row.sales))), vs);

  return (
    <>
      <PageHeader title="Mis tiendas" description="Cada tienda tiene su propio horario, su catálogo y su inventario, y aquí ves cuánto vende cada una." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar tus tiendas. Recarga la página.</Alert> : null}
      {errors.length > 0 ? <Alert tone="error" className="mb-5">No pudimos cargar todas las ventas. Recarga la página.</Alert> : null}
      {rows.length > 0 ? (
        <>
          <div className="mb-5">
            <FilterChips basePath="/comercio/tiendas" param="periodo" current={period.key} options={periodOptions} />
          </div>
          <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <li><KpiCard icon={<Banknote className="size-[18px]" />} tone="lavanda" label={`Ventas (${word})`} value={formatMoney(totalSales)} trend={single ? trend : undefined} hint={single ? undefined : "Suma de todas tus tiendas"} /></li>
            <li><KpiCard icon={<ShoppingBag className="size-[18px]" />} label={`Pedidos (${word})`} value={totalOrders} hint={totalOrders > 0 ? `Ticket promedio ${formatMoney(totalSales / totalOrders)}` : "Sin ventas en el periodo"} /></li>
            <li><KpiCard icon={<Store className="size-[18px]" />} label="Tiendas" value={rows.length} hint="Registradas en tu comercio" /></li>
            <li><KpiCard icon={<Trophy className="size-[18px]" />} tone="durazno" label="Tienda que más vende" value={leader && (leader.metrics?.sales ?? 0) > 0 ? leader.name : "—"} hint={leader && (leader.metrics?.sales ?? 0) > 0 ? `${formatMoney(leader.metrics?.sales ?? 0)} ${word}` : "Sin ventas en el periodo"} /></li>
          </ul>
          <Card className="mb-5 p-5">
            {single ? (
              <>
                <CardHeader title="Lo vendido por día" subtitle={period.days > 1 ? `${period.label} contra ${vs}` : "Elige 7 días, Quincena o Mes para ver la tendencia"} />
                {period.days > 1 ? (
                  <LineChart
                    ariaLabel={`Ventas por día, ${period.label}`}
                    labels={labels}
                    formatValue={compactMoney}
                    series={[
                      { name: "Periodo actual", tone: "hoja", values: currentSeries.map((point) => point.value) },
                      { name: "Periodo anterior", tone: "gris", dashed: true, values: previousSeries.map((point) => point.value) },
                    ]}
                  />
                ) : null}
              </>
            ) : (
              <>
                <CardHeader title="Ventas por tienda" subtitle={`Comparación ${word}`} />
                <HBarList items={[...rows].sort((a, b) => (b.metrics?.sales ?? 0) - (a.metrics?.sales ?? 0)).map((row) => ({ label: row.name, value: row.metrics?.sales ?? 0, tone: "hoja" as const }))} formatValue={formatMoney} />
              </>
            )}
          </Card>
        </>
      ) : null}
      <StoresWorkspace rows={rows} create={createStore} periodLabel={word} />
    </>
  );
}
