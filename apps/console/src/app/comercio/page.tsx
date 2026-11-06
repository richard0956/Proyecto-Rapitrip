import { Alert, Badge, Card, CardHeader, EmptyState, KpiCard, LineChart, buttonStyles, ButtonIsland } from "@rapitrip/ui";
import { BellRing, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CatalogNotices } from "@/components/catalog-notices";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { StoreFilter } from "@/components/store-filter";
import { markCatalogReportFixed } from "@/lib/catalog-control-actions";
import { compactMoney, fillDays, firstDays, minutesUntil, parsePeriod, periodOptions, trendOf } from "@/lib/dashboard";
import { first, optionalUuid, type SearchParams } from "@/lib/filters";
import { timeAgo } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { loadCatalogNotices } from "@/lib/load-catalog-notices";
import { formatMoney } from "@/lib/money";
import { orderStatuses, orderStatusLabel, orderStatusTone, type OrderStatus } from "@/lib/orders";
import { storeState } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Inicio" };

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Una lista corta con enlace al lugar donde está el detalle completo. */
function ShortList({ title, subtitle, href, linkLabel, children }: { title: string; subtitle: string; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <CardHeader title={title} subtitle={subtitle} />
      <div className="flex-1">{children}</div>
      <Link href={href} className="mt-3 self-start rounded text-[13px] font-bold text-hoja underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-hoja">
        {linkLabel}
      </Link>
    </Card>
  );
}

export default async function ComercioHome({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await requireConsoleAccess("comercio");
  const period = parsePeriod(first(params.periodo));
  const today = parsePeriod("hoy");
  const supabase = await serverSupabase();
  const catalogNotices = await loadCatalogNotices(supabase);

  // Primero las tiendas: el filtro `?tienda=` solo vale si es una tienda de este comercio (la RLS ya oculta las ajenas).
  const [profile, stores] = await Promise.all([
    supabase.from("my_profile").select("full_name").maybeSingle(),
    supabase.from("stores_list").select("id, name, status, closed_until, open_now, hour_ranges, latitude, longitude").order("name"),
  ]);
  if (stores.error) console.error("[comercio:inicio]", stores.error.message);
  const rows = stores.data ?? [];
  const requestedStore = optionalUuid.parse(first(params.tienda));
  const store = requestedStore && rows.some((row) => row.id === requestedStore) ? requestedStore : undefined;

  // Solo pedidos de sus propias tiendas: la seguridad de filas también deja ver las compras que el dueño hace como cliente.
  const ownStores = rows.flatMap((row) => (row.id ? [row.id] : []));
  const scope = ownStores.length > 0 ? ownStores : ["00000000-0000-0000-0000-000000000000"];
  let stockQuery = supabase.from("inventory_list").select("variant_id, product_name, variant_name, store_name, quantity, stock_state").eq("variant_status", "activa").in("stock_state", ["agotado", "bajo"]).order("quantity").limit(5);
  let reorderQuery = supabase.from("inventory_list").select("*", { count: "exact", head: true }).in("stock_state", ["agotado", "bajo"]).eq("variant_status", "activa");
  let pendingQuery = supabase.from("orders_list").select("number, expires_at").eq("status", "por_confirmar").in("store_id", scope).order("expires_at");
  let recentQuery = supabase.from("orders_list").select("id, number, store_name, status, total, created_at").in("store_id", scope).order("created_at", { ascending: false }).limit(5);
  if (store) {
    stockQuery = stockQuery.eq("store_id", store);
    reorderQuery = reorderQuery.eq("store_id", store);
    pendingQuery = pendingQuery.eq("store_id", store);
    recentQuery = recentQuery.eq("store_id", store);
  }
  const range = { p_from: period.from, p_to: period.to, p_store: store };
  const [stock, reorder, pending, recent, current, previous, top] = await Promise.all([
    stockQuery,
    reorderQuery,
    pendingQuery,
    recentQuery,
    supabase.rpc("sales_by_day", range),
    supabase.rpc("sales_by_day", { p_from: period.prevFrom, p_to: period.prevTo, p_store: store }),
    supabase.rpc("top_products", { ...range, p_limit: 3 }),
  ]);
  const errors = [stock, reorder, pending, recent, current, previous, top].flatMap((result) => (result.error ? [result.error.message] : []));
  if (errors.length > 0) console.error("[comercio:inicio:cifras]", errors.join(" | "));

  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const currentRows = current.data ?? [];
  const previousRows = previous.data ?? [];
  const sales = sum(currentRows.map((row) => Number(row.sales)));
  const orders = sum(currentRows.map((row) => Number(row.orders)));
  const vs = period.key === "mes" ? "el mes anterior" : period.key === "quincena" ? "la quincena anterior" : period.key === "7d" ? "los 7 días anteriores" : "ayer";
  const periodWord = period.key === "hoy" ? "hoy" : period.key === "7d" ? "7 días" : period.key === "quincena" ? "esta quincena" : "este mes";

  const upTo = period.to < today.to ? period.to : today.to;
  const labels = fillDays([], period.from, period.to).map((point) => point.day.slice(8));
  const currentSeries = fillDays(currentRows.map((row) => ({ day: row.day, value: Number(row.sales) })), period.from, upTo);
  const previousSeries = fillDays(previousRows.map((row) => ({ day: row.day, value: Number(row.sales) })), period.prevFrom, period.from).slice(0, labels.length);
  const comparable = firstDays(previousRows, period.prevFrom, currentSeries.length);
  const previousSales = sum(comparable.map((row) => Number(row.sales)));
  const previousOrders = sum(comparable.map((row) => Number(row.orders)));
  const ticket = orders > 0 ? sales / orders : 0;
  const previousTicket = previousOrders > 0 ? previousSales / previousOrders : 0;

  const waiting = (pending.data ?? []).flatMap((row) => (row.number === null ? [] : [{ number: Number(row.number), minutes: minutesUntil(row.expires_at) }]));
  const needsRestock = reorder.count ?? 0;
  const active = rows.filter((row) => row.status === "activa");
  const closedNow = active.filter((row) => storeState(row).tone !== "positive");
  const noHours = active.filter((row) => !row.hour_ranges);
  const noLocation = active.filter((row) => row.latitude === null || row.longitude === null);
  const storeNames = (list: typeof rows) => list.map((row) => row.name).join(", ");
  const topRows = top.data ?? [];
  const recentRows = (recent.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    return row.id && row.number !== null && status ? [{ id: row.id, number: Number(row.number), store: row.store_name ?? "", status, total: Number(row.total ?? 0), createdAt: row.created_at }] : [];
  });
  const storeOptions = rows.flatMap((row) => (row.id && row.name ? [{ id: row.id, name: row.name }] : []));

  return (
    <>
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Hola"}
        description="Lo que necesita tu atención y cómo van tus ventas."
        actions={
          <Link href="/comercio/tiendas" className={buttonStyles({ variant: "primary", className: "pr-5" })}>
            Mis tiendas
            <ButtonIsland />
          </Link>
        }
      />
      <CatalogNotices notices={catalogNotices} markFixed={markCatalogReportFixed} />
      {stores.error || errors.length > 0 ? <Alert tone="error" className="mb-5">No pudimos cargar todas las cifras. Recarga la página.</Alert> : null}

      {/* Atención: solo aparece lo que hay que resolver; cada aviso lleva al lugar donde se resuelve. */}
      {waiting.length > 0 || needsRestock > 0 || closedNow.length > 0 || noHours.length > 0 || noLocation.length > 0 ? (
        <section aria-label="Necesita tu atención" className="mb-5 flex flex-col gap-2.5">
          {waiting.length > 0 ? (
            <Alert tone="warning" icon={<BellRing className="size-[18px]" />}>
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
          {needsRestock > 0 ? (
            <Alert tone="warning">
              <Link href="/comercio/inventario" className="font-bold underline">
                {needsRestock === 1 ? "1 variante por reponer" : `${needsRestock} variantes por reponer`}
              </Link>
              {" — agotadas o con stock bajo."}
            </Alert>
          ) : null}
          {noLocation.length > 0 ? (
            <Alert tone="warning">
              <Link href={`/comercio/tiendas/${noLocation[0]?.id}`} className="font-bold underline">
                Sin ubicación en el mapa
              </Link>
              {` — ${storeNames(noLocation)} no recibe${noLocation.length === 1 ? "" : "n"} pedidos hasta marcarla.`}
            </Alert>
          ) : null}
          {noHours.length > 0 ? (
            <Alert tone="info">
              <Link href={`/comercio/tiendas/${noHours[0]?.id}`} className="font-bold underline">
                Sin horario definido
              </Link>
              {` — ${storeNames(noHours)}.`}
            </Alert>
          ) : null}
          {closedNow.length > 0 ? (
            <Alert tone="info">
              {`Cerrada${closedNow.length === 1 ? "" : "s"} ahora: `}
              {closedNow.map((row, index) => (
                <span key={row.id}>
                  {index > 0 ? ", " : ""}
                  <Link href={`/comercio/tiendas/${row.id}`} className="font-bold underline">
                    {row.name}
                  </Link>
                </span>
              ))}
              {"."}
            </Alert>
          ) : null}
        </section>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterChips basePath="/comercio" param="periodo" current={period.key} options={periodOptions} keep={{ tienda: store }} />
        {storeOptions.length > 1 ? <StoreFilter basePath="/comercio" stores={storeOptions} current={store} keep={{ periodo: period.key }} /> : null}
      </div>

      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <li>
          <KpiCard icon={<TrendingUp className="size-[18px]" />} tone="lavanda" label={`Ventas (${periodWord})`} value={current.error ? "—" : formatMoney(sales)} trend={trendOf(sales, previousSales, vs)} />
        </li>
        <li>
          <KpiCard icon={<ShoppingBag className="size-[18px]" />} label={`Pedidos (${periodWord})`} value={current.error ? "—" : orders} trend={trendOf(orders, previousOrders, vs)} />
        </li>
        <li>
          <KpiCard icon={<Receipt className="size-[18px]" />} tone="lavanda" label="Ticket promedio" value={current.error || orders === 0 ? "—" : formatMoney(ticket)} trend={orders > 0 && previousOrders > 0 ? trendOf(ticket, previousTicket, vs) : undefined} hint={orders === 0 ? "Aún no hay pedidos en el periodo" : undefined} />
        </li>
      </ul>

      <Card outerClassName="mb-5" className="p-5">
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <ShortList title="Pedidos recientes" subtitle="Los últimos 5" href="/comercio/pedidos" linkLabel="Ver todos los pedidos">
          {recentRows.length === 0 ? (
            <EmptyState title="Aún no hay pedidos">Cuando entre uno, aparece aquí.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {recentRows.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-tinta">
                      #{order.number} · <span className="tabular-nums">{formatMoney(order.total)}</span>
                    </p>
                    <p className="truncate text-xs text-tinta-suave">
                      {order.store}
                      {order.createdAt ? ` · ${timeAgo(order.createdAt)}` : ""}
                    </p>
                  </div>
                  <Badge tone={orderStatusTone[order.status]}>{orderStatusLabel[order.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </ShortList>

        <ShortList title="Stock por reponer" subtitle="Lo más bajo primero" href="/comercio/inventario" linkLabel="Ir al inventario">
          {(stock.data ?? []).length === 0 ? (
            <EmptyState title="Nada que reponer">Ninguna variante está agotada o con stock bajo.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {(stock.data ?? []).map((row) => (
                <li key={row.variant_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-tinta">
                      {row.product_name} · {row.variant_name}
                    </p>
                    <p className="truncate text-xs text-tinta-suave">{row.store_name}</p>
                  </div>
                  <Badge tone={row.stock_state === "agotado" ? "danger" : "warning"}>{row.stock_state === "agotado" ? "Agotado" : `${Number(row.quantity ?? 0)} u.`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </ShortList>

        <ShortList title="Más vendidos" subtitle={`Unidades (${periodWord})`} href="/comercio/catalogo" linkLabel="Ver el catálogo">
          {topRows.length === 0 ? (
            <EmptyState title="Sin ventas en el periodo">Aquí verás lo que más sale.</EmptyState>
          ) : (
            <ol className="flex flex-col divide-y divide-borde">
              {topRows.map((row, index) => (
                <li key={row.product_name ?? index} className="flex items-center gap-3 py-2.5">
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-hoja/10 text-xs font-bold text-hoja">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-tinta">{row.product_name ?? "Producto"}</span>
                  <span className="text-sm tabular-nums text-tinta-suave">{Number(row.units)} u.</span>
                </li>
              ))}
            </ol>
          )}
        </ShortList>
      </div>
    </>
  );
}
