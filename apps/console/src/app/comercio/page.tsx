import { Alert, Badge, Card, CardHeader, DataTable, EmptyState, HBarList, KpiCard, LineChart, buttonStyles, ButtonIsland } from "@rapitrip/ui";
import { Banknote, BellRing, ChefHat, PackageCheck, PackageX, ShoppingBag, TrendingUp } from "lucide-react";
import Link from "next/link";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { StoreFilter } from "@/components/store-filter";
import { compactMoney, fillDays, firstDays, minutesUntil, parsePeriod, periodOptions, trendOf } from "@/lib/dashboard";
import { first, optionalUuid, type SearchParams } from "@/lib/filters";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { serverSupabase } from "@/lib/supabase";
import { storeState } from "@/lib/stores";

export const metadata = { title: "Inicio" };

const stockChips = [
  { key: "bajo", label: "Stock bajo" },
  { key: "agotado", label: "Agotados" },
  { key: "todos", label: "Todos" },
];

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export default async function ComercioHome({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await requireConsoleAccess("comercio");
  const period = parsePeriod(first(params.periodo));
  const today = parsePeriod("hoy");
  const stockFilter = stockChips.find((chip) => chip.key === first(params.inventario))?.key ?? "bajo";
  const supabase = await serverSupabase();

  // Primero las tiendas: el filtro `?tienda=` solo vale si es una tienda de este comercio (la RLS ya oculta las ajenas).
  const [profile, stores] = await Promise.all([
    supabase.from("my_profile").select("full_name").maybeSingle(),
    supabase.from("stores_list").select("id, name, status, closed_until, open_now, hour_ranges").order("name"),
  ]);
  if (stores.error) console.error("[comercio:inicio]", stores.error.message);
  const rows = stores.data ?? [];
  const requestedStore = optionalUuid.parse(first(params.tienda));
  const store = requestedStore && rows.some((row) => row.id === requestedStore) ? requestedStore : undefined;

  let stockQuery = supabase.from("inventory_list").select("variant_id, product_name, variant_name, store_name, quantity, stock_state").eq("variant_status", "activa").order("quantity").limit(20);
  stockQuery = stockFilter === "todos" ? stockQuery : stockQuery.eq("stock_state", stockFilter);
  let reorderQuery = supabase.from("inventory_list").select("*", { count: "exact", head: true }).in("stock_state", ["agotado", "bajo"]).eq("variant_status", "activa");
  // Solo pedidos de sus propias tiendas: la seguridad de filas también deja ver las compras que el dueño hace como cliente.
  const ownStores = rows.flatMap((row) => (row.id ? [row.id] : []));
  let pendingQuery = supabase.from("orders_list").select("number, expires_at").eq("status", "por_confirmar").in("store_id", ownStores.length > 0 ? ownStores : ["00000000-0000-0000-0000-000000000000"]).order("expires_at");
  if (store) {
    stockQuery = stockQuery.eq("store_id", store);
    reorderQuery = reorderQuery.eq("store_id", store);
    pendingQuery = pendingQuery.eq("store_id", store);
  }
  const range = { p_from: period.from, p_to: period.to, p_store: store };
  const [stock, reorder, pending, current, previous, todaySales, top, delivered, prep] = await Promise.all([
    stockQuery,
    reorderQuery,
    pendingQuery,
    supabase.rpc("sales_by_day", range),
    supabase.rpc("sales_by_day", { p_from: period.prevFrom, p_to: period.prevTo, p_store: store }),
    supabase.rpc("sales_by_day", { p_from: today.from, p_to: today.to, p_store: store }),
    supabase.rpc("top_products", { ...range, p_limit: 200 }),
    supabase.rpc("delivered_totals", range),
    supabase.rpc("avg_prep_minutes", range),
  ]);
  const errors = [stock, reorder, pending, current, previous, todaySales, top, delivered, prep].flatMap((result) => (result.error ? [result.error.message] : []));
  if (errors.length > 0) console.error("[comercio:inicio:cifras]", errors.join(" | "));

  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const currentRows = current.data ?? [];
  const previousRows = previous.data ?? [];
  const sales = sum(currentRows.map((row) => Number(row.sales)));
  const orders = sum(currentRows.map((row) => Number(row.orders)));
  const salesToday = sum((todaySales.data ?? []).map((row) => Number(row.sales)));
  const ordersToday = sum((todaySales.data ?? []).map((row) => Number(row.orders)));
  const vs = period.key === "mes" ? "el mes anterior" : period.key === "quincena" ? "la quincena anterior" : period.key === "7d" ? "los 7 días anteriores" : "ayer";
  const periodWord = period.key === "hoy" ? "hoy" : period.key === "7d" ? "7 días" : period.key === "quincena" ? "esta quincena" : "este mes";

  const todayEnd = today.to;
  const upTo = period.to < todayEnd ? period.to : todayEnd;
  const labels = fillDays([], period.from, period.to).map((point) => point.day.slice(8));
  const currentSeries = fillDays(currentRows.map((row) => ({ day: row.day, value: Number(row.sales) })), period.from, upTo);
  const previousSeries = fillDays(previousRows.map((row) => ({ day: row.day, value: Number(row.sales) })), period.prevFrom, period.from).slice(0, labels.length);

  const comparable = firstDays(previousRows, period.prevFrom, currentSeries.length);
  const topRows = top.data ?? [];
  const soldByProduct = new Map(topRows.map((row) => [row.product_name ?? "", Number(row.units)]));
  const topBars = topRows.slice(0, 5).map((row) => ({ label: row.product_name ?? "Producto", value: Number(row.units), tone: "hoja" as const }));
  const deliveredTotals = delivered.data?.[0];
  const prepMinutes = prep.data === null || prep.data === undefined ? null : Number(prep.data);
  const waiting = (pending.data ?? []).flatMap((row) => (row.number === null ? [] : [{ number: Number(row.number), minutes: minutesUntil(row.expires_at) }]));
  const open = rows.filter((row) => storeState(row).tone === "positive").length;
  const noHours = rows.filter((row) => row.status === "activa" && !row.hour_ranges);
  const storeOptions = rows.flatMap((row) => (row.id && row.name ? [{ id: row.id, name: row.name }] : []));
  const stockRows = (stock.data ?? []).flatMap((row) => (row.variant_id ? [{ id: row.variant_id, product: row.product_name ?? "", variant: row.variant_name ?? "", store: row.store_name ?? "", quantity: Number(row.quantity ?? 0), state: row.stock_state ?? "" }] : []));

  return (
    <>
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Hola"}
        description="Tus ventas, tu inventario y lo que espera tu respuesta."
        actions={
          <Link href="/comercio/tiendas" className={buttonStyles({ variant: "primary", className: "pr-5" })}>
            Mis tiendas
            <ButtonIsland />
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterChips basePath="/comercio" param="periodo" current={period.key} options={periodOptions} keep={{ tienda: store, inventario: stockFilter === "bajo" ? undefined : stockFilter }} />
        {storeOptions.length > 1 ? <StoreFilter basePath="/comercio" stores={storeOptions} current={store} keep={{ periodo: period.key, inventario: stockFilter === "bajo" ? undefined : stockFilter }} /> : null}
      </div>
      {stores.error || errors.length > 0 ? <Alert tone="error" className="mb-5">No pudimos cargar todas las cifras. Recarga la página.</Alert> : null}
      {waiting.length > 0 ? (
        <Alert tone="warning" className="mb-5">
          <Link href="/comercio/pedidos" className="font-bold underline">
            {waiting.length === 1 ? "1 pedido espera tu confirmación" : `${waiting.length} pedidos esperan tu confirmación`}
          </Link>
          {" — "}
          {waiting
            .slice(0, 3)
            .map((order) => (order.minutes === null ? `#${order.number}` : order.minutes === 0 ? `#${order.number} vence ya` : `#${order.number} vence en ${order.minutes} min`))
            .join(" · ")}
        </Alert>
      ) : null}

      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <Link href="/comercio/pedidos" className="group block h-full rounded-tarjeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
            <KpiCard icon={<BellRing className="size-[18px]" />} tone="durazno" label="Pedidos por confirmar" value={pending.error ? "—" : waiting.length} hint="Esperan tu respuesta" />
          </Link>
        </li>
        <li>
          <KpiCard icon={<Banknote className="size-[18px]" />} label="Ventas de hoy" value={todaySales.error ? "—" : formatMoney(salesToday)} hint={`${ordersToday} ${ordersToday === 1 ? "pedido" : "pedidos"} hoy, contando los confirmados`} />
        </li>
        <li>
          <KpiCard icon={<TrendingUp className="size-[18px]" />} tone="lavanda" label={`Ventas (${periodWord})`} value={current.error ? "—" : formatMoney(sales)} trend={trendOf(sales, sum(comparable.map((row) => Number(row.sales))), vs)} />
        </li>
        <li>
          <KpiCard icon={<ShoppingBag className="size-[18px]" />} label={`Pedidos (${periodWord})`} value={current.error ? "—" : orders} trend={trendOf(orders, sum(comparable.map((row) => Number(row.orders))), vs)} />
        </li>
        <li>
          <KpiCard icon={<ChefHat className="size-[18px]" />} tone="lavanda" label="Preparación promedio" value={prepMinutes === null ? "—" : `${prepMinutes} min`} hint={prepMinutes === null ? "Aún no hay pedidos preparados en el periodo" : "Entre «preparando» y «listo»"} />
        </li>
        <li>
          <KpiCard
            icon={<PackageCheck className="size-[18px]" />}
            label="Productos entregados"
            value={delivered.error ? "—" : formatMoney(Number(deliveredTotals?.products ?? 0))}
            hint={`${Number(deliveredTotals?.orders ?? 0)} ${Number(deliveredTotals?.orders ?? 0) === 1 ? "pedido entregado" : "pedidos entregados"} (${periodWord})`}
          />
        </li>
        <li>
          <Link href="/comercio/inventario" className="group block h-full rounded-tarjeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
            <KpiCard icon={<PackageX className="size-[18px]" />} tone="durazno" label="Stock por reponer" value={reorder.error ? "—" : (reorder.count ?? 0)} hint="Variantes agotadas o con stock bajo" />
          </Link>
        </li>
        <li>
          <KpiCard icon={<ShoppingBag className="size-[18px]" />} tone="lavanda" label="Tiendas abiertas ahora" value={`${open} de ${rows.length}`} hint={noHours.length > 0 ? `${noHours.length} sin horario definido` : "Según horario y cierres"} />
        </li>
      </ul>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <CardHeader title="Ventas por día" subtitle={period.days > 1 ? `${period.label} contra ${vs}` : "Elige 7 días, Quincena o Mes para ver la tendencia"} />
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
        </Card>
        <Card className="p-5">
          <CardHeader title="Más vendidos" subtitle="Unidades en el periodo" />
          <HBarList items={topBars} />
        </Card>
      </div>

      <Card className="mb-5 p-5">
        <CardHeader title="Inventario" subtitle="Hasta 20 variantes por vista; el detalle completo está en Inventario" />
        <div className="mb-3.5">
          <FilterChips basePath="/comercio" param="inventario" current={stockFilter} options={stockChips} keep={{ periodo: period.key, tienda: store }} />
        </div>
        <DataTable
          caption="Inventario"
          columns={[
            { header: "Producto", cell: (row) => <span className="font-bold text-tinta">{row.product} · {row.variant}</span> },
            { header: "Tienda", cell: (row) => row.store },
            { header: "Stock", cell: (row) => <span className="tabular-nums">{row.quantity}</span> },
            { header: `Vendidos (${periodWord})`, cell: (row) => <span className="tabular-nums">{soldByProduct.get(row.product) ?? 0}</span> },
            { header: "Estado", cell: (row) => <Badge tone={row.state === "agotado" ? "danger" : row.state === "bajo" ? "warning" : "positive"}>{row.state === "agotado" ? "Agotado" : row.state === "bajo" ? "Stock bajo" : row.state === "disponible" ? "Disponible" : "Sin control"}</Badge> },
          ]}
          rows={stockRows}
          rowKey={(row) => row.id}
          emptyTitle={stockFilter === "todos" ? "Todavía no hay variantes" : "Nada que reponer"}
          emptyHint={stockFilter === "todos" ? "Crea productos en el catálogo para ver su inventario." : "Ninguna variante está en este estado."}
        />
      </Card>

      <Card className="p-5">
        <CardHeader title="Tus tiendas" />
        {rows.length === 0 ? (
          <EmptyState title="Todavía no tienes tiendas">Crea la primera en «Mis tiendas» para definir su horario.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {rows.map((row) => {
              const state = storeState(row);
              return (
                <li key={row.id}>
                  <Link href={`/comercio/tiendas/${row.id}`} className="flex items-center justify-between gap-3 rounded-campo py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                    <span className="font-bold text-tinta">{row.name}</span>
                    <span className={state.tone === "positive" ? "text-xs font-bold text-exito" : "text-xs font-bold text-tinta-suave"}>{state.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
