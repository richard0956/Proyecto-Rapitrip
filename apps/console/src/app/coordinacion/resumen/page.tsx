import { Alert, Badge, Card, CardHeader, DataTable, HBarList, KpiCard, buttonStyles } from "@rapitrip/ui";
import { AlertTriangle, Banknote, CheckCheck, Download, Truck } from "lucide-react";
import Link from "next/link";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { StoreFilter } from "@/components/store-filter";
import { minutesUntil, parsePeriod } from "@/lib/dashboard";
import { first, optionalUuid, type SearchParams } from "@/lib/filters";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { orderStatuses, orderStatusLabel, orderStatusTone, paymentLabel, salesStatuses, type OrderStatus } from "@/lib/orders";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Resumen" };

const filters = [
  { key: "activos", label: "Activos" },
  { key: "excepcion", label: "Con excepción" },
  { key: "entregados", label: "Entregados" },
];
const activeStatuses: OrderStatus[] = ["por_confirmar", "en_validacion", "confirmado", "preparando", "listo", "en_camino"];

type Row = { id: string; number: number; store: string; courierId: string | null; total: number; method: string | null; paymentStatus: string | null; status: OrderStatus; courier: string | null; alert: string | null };

export default async function CoordinacionResumen({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await requireConsoleAccess("coordinacion");
  const filter = filters.find((chip) => chip.key === first(params.filtro))?.key ?? "activos";
  const store = optionalUuid.parse(first(params.tienda));
  const courierFilter = optionalUuid.parse(first(params.repartidor));
  const today = parsePeriod("hoy");
  const supabase = await serverSupabase();

  let ordersQuery = supabase
    .from("orders_list")
    .select("id, number, store_id, store_name, status, payment_method, payment_status, total, courier_id, expires_at")
    .gte("created_at", today.from)
    .lt("created_at", today.to)
    .order("created_at", { ascending: false })
    .limit(300);
  if (store) ordersQuery = ordersQuery.eq("store_id", store);
  // Las tiendas del selector salen de los pedidos del día (coordinación no lee `stores_list`), sin el filtro de tienda para no quedarse con una sola.
  const [orders, couriers, storeSource] = await Promise.all([
    ordersQuery,
    supabase.from("couriers_list").select("id, full_name").order("full_name"),
    supabase.from("orders_list").select("store_id, store_name").gte("created_at", today.from).lt("created_at", today.to).limit(300),
  ]);
  const failed = [orders.error, couriers.error, storeSource.error].flatMap((error) => (error ? [error.message] : []));
  if (failed.length > 0) console.error("[coordinacion:resumen]", failed.join(" | "));

  const courierName = new Map((couriers.data ?? []).flatMap((row) => (row.id ? [[row.id, row.full_name ?? ""] as const] : [])));
  const all: Row[] = (orders.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    if (!row.id || row.number === null || !status) return [];
    const overdue = status === "por_confirmar" && row.expires_at !== null && minutesUntil(row.expires_at) === 0;
    const alert = overdue ? "Confirmación vencida" : status === "listo" && !row.courier_id ? "Listo sin repartidor" : null;
    return [{ id: row.id, number: Number(row.number), store: row.store_name ?? "", total: Number(row.total ?? 0), method: row.payment_method, paymentStatus: row.payment_status, status, courierId: row.courier_id, courier: row.courier_id ? (courierName.get(row.courier_id) ?? "Asignado") : null, alert }];
  });

  const isSale = (row: Row) => salesStatuses.includes(row.status);
  const soldToday = all.filter(isSale).reduce((total, row) => total + row.total, 0);
  const active = all.filter((row) => activeStatuses.includes(row.status));
  const exceptions = all.filter((row) => row.alert !== null);
  const delivered = all.filter((row) => row.status === "entregado");
  const notCancelled = all.filter((row) => row.status !== "cancelado" && row.status !== "rechazado");
  const byStage = orderStatuses.flatMap((status) => {
    const total = all.filter((row) => row.status === status).length;
    return total > 0 ? [{ label: orderStatusLabel[status], value: total, tone: status === "cancelado" || status === "rechazado" ? ("marino" as const) : ("hoja" as const) }] : [];
  });
  const byMethod = [
    { label: "Efectivo", value: all.filter((row) => isSale(row) && row.method === "efectivo").reduce((total, row) => total + row.total, 0), tone: "hoja" as const },
    { label: "Tarjeta", value: all.filter((row) => isSale(row) && row.method === "tarjeta").reduce((total, row) => total + row.total, 0), tone: "marino" as const },
  ].filter((item) => item.value > 0);
  const byFilter = filter === "excepcion" ? exceptions : filter === "entregados" ? delivered : active;
  const visible = courierFilter ? byFilter.filter((row) => row.courierId === courierFilter) : byFilter;
  const storeOptions = [...new Map((storeSource.data ?? []).flatMap((row) => (row.store_id && row.store_name ? [[row.store_id, row.store_name] as const] : []))).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  const courierOptions = (couriers.data ?? []).flatMap((row) => (row.id && row.full_name ? [{ id: row.id, name: row.full_name }] : []));

  return (
    <>
      <PageHeader
        title="Resumen del día"
        description="Qué pedido necesita tu atención ahora y cuánto se vendió hoy."
        actions={
          <a href="/coordinacion/informe" className={buttonStyles({ variant: "secondary" })}>
            <Download className="size-4" aria-hidden="true" />
            Descargar informe
          </a>
        }
      />
      {failed.length > 0 ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard icon={<Banknote className="size-[18px]" />} tone="lavanda" label="Vendido hoy" value={formatMoney(soldToday)} hint="Pedidos confirmados en adelante" /></li>
        <li><KpiCard icon={<Truck className="size-[18px]" />} label="Pedidos activos" value={active.length} hint="Sin entregar ni cancelar" /></li>
        <li><KpiCard icon={<AlertTriangle className="size-[18px]" />} tone="durazno" label="Excepciones" value={exceptions.length} hint="Confirmación vencida o listo sin repartidor" /></li>
        <li><KpiCard icon={<CheckCheck className="size-[18px]" />} label="Entregados hoy" value={`${delivered.length} de ${notCancelled.length}`} hint="Sobre los pedidos no cancelados" /></li>
      </ul>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Pedidos por etapa" />
          <HBarList items={byStage} />
        </Card>
        <Card className="p-5">
          <CardHeader title="Ventas del día por medio de pago" />
          <HBarList items={byMethod} formatValue={formatMoney} />
        </Card>
      </div>

      <Card className="p-5">
        <CardHeader title="Pedidos del día" subtitle="Para operarlos, abre Pedidos" />
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <FilterChips basePath="/coordinacion/resumen" param="filtro" current={filter} options={filters.map((chip) => ({ ...chip, count: chip.key === "excepcion" ? exceptions.length : chip.key === "entregados" ? delivered.length : active.length }))} keep={{ tienda: store, repartidor: courierFilter }} />
          <StoreFilter basePath="/coordinacion/resumen" stores={storeOptions} current={store} keep={{ filtro: filter }} extra={{ name: "repartidor", label: "Repartidor", allLabel: "Todos los repartidores", options: courierOptions, current: courierFilter }} />
        </div>
        <DataTable
          caption="Pedidos del día"
          columns={[
            { header: "Pedido", cell: (row) => <Link href="/coordinacion" className="font-bold text-hoja underline">#{row.number}</Link> },
            { header: "Tienda", cell: (row) => row.store },
            { header: "Total", cell: (row) => <span className="tabular-nums">{formatMoney(row.total)}</span> },
            { header: "Pago", cell: (row) => paymentLabel(row.method, row.paymentStatus) },
            { header: "Etapa", cell: (row) => <Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge> },
            { header: "Repartidor", cell: (row) => row.courier ?? "—" },
            { header: "Alerta", cell: (row) => (row.alert ? <Badge tone="danger">{row.alert}</Badge> : "—") },
          ]}
          rows={visible}
          rowKey={(row) => row.id}
          emptyTitle={filter === "excepcion" ? "Sin excepciones" : filter === "entregados" ? "Aún no hay entregas hoy" : "No hay pedidos activos"}
          emptyHint="Cuando haya pedidos que cumplan este filtro, aparecerán aquí."
        />
      </Card>
    </>
  );
}
