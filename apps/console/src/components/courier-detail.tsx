import { Alert, Badge, Card, CardHeader, DataTable, KpiCard, LineChart, buttonStyles } from "@rapitrip/ui";
import { ArrowLeft, Banknote, CheckCheck, Clock, Route, Truck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { loadCourierStats } from "@/lib/courier-data";
import { formatKm, formatMinutes, rankCouriers } from "@/lib/couriers";
import { fillDays, parsePeriod, periodOptions } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { orderStatusLabel, orderStatusTone, orderStatuses, paymentLabel, type OrderStatus } from "@/lib/orders";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";

const periodWord = { hoy: "hoy", "7d": "los últimos 7 días", quincena: "esta quincena", mes: "este mes" } as const;

type Props = {
  id: string;
  /** Ruta de la lista de repartidores del área (también es la base de los filtros de esta ficha). */
  listPath: string;
  /** Periodo pedido en la URL. */
  periodKey: string | undefined;
  /** Solo el administrador pasa su panel de edición. */
  manage?: ReactNode;
};

/** Ficha del repartidor: cifras del periodo, su posición entre los demás, entregas por día y sus pedidos recientes. */
export async function CourierDetail({ id, listPath, periodKey, manage }: Props) {
  const period = parsePeriod(periodKey);
  const word = periodWord[period.key];
  const [{ rows, failed }, supabase] = await Promise.all([loadCourierStats(period), serverSupabase()]);
  const courier = rows.find((row) => row.id === id);
  if (!courier) return null;

  const [daily, orders] = await Promise.all([
    supabase.rpc("courier_daily", { p_courier: id, p_from: period.from, p_to: period.to }),
    supabase
      .from("orders_list")
      .select("id, number, store_name, status, total, payment_method, payment_status, delivered_at, updated_at")
      .eq("courier_id", id)
      .in("status", ["confirmado", "preparando", "listo", "en_camino", "entregado"])
      .order("updated_at", { ascending: false })
      .limit(15),
  ]);
  if (daily.error || orders.error) console.error("[repartidor:detalle]", daily.error?.message, orders.error?.message);

  const todayEnd = parsePeriod("hoy").to;
  const upTo = period.to < todayEnd ? period.to : todayEnd;
  const labels = fillDays([], period.from, period.to).map((point) => point.day.slice(8));
  const dailyRows = daily.data ?? [];
  const deliveriesSeries = fillDays(dailyRows.map((row) => ({ day: row.day, value: Number(row.deliveries) })), period.from, upTo).map((point) => point.value);
  const kmSeries = fillDays(dailyRows.map((row) => ({ day: row.day, value: Number(row.km) })), period.from, upTo).map((point) => point.value);

  const position = rankCouriers(rows, "entregas", rows.length).findIndex((row) => row.id === id) + 1;
  const recent = (orders.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    return row.id && row.number !== null && status ? [{ id: row.id, number: Number(row.number), store: row.store_name ?? "", status, total: Number(row.total ?? 0), payment: paymentLabel(row.payment_method, row.payment_status), at: formatStoreDateTime(row.delivered_at ?? row.updated_at) }] : [];
  });

  return (
    <>
      <PageHeader
        title={courier.name}
        description={`${courier.vehicle} · ${courier.phone} · prestador de servicio desde ${courier.since}`}
        actions={
          <Link href={listPath} className={buttonStyles({ variant: "ghost" })}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Repartidores
          </Link>
        }
      />
      {failed || daily.error || orders.error ? <Alert tone="error" className="mb-5">No pudimos cargar todas las cifras del repartidor. Recarga la página.</Alert> : null}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <FilterChips basePath={`${listPath}/${id}`} param="periodo" current={period.key} options={periodOptions} />
        <Badge tone={courier.status === "activo" ? "positive" : "warning"}>{courier.status === "activo" ? "Activo" : "Inactivo"}</Badge>
      </div>

      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <li><KpiCard icon={<CheckCheck className="size-[18px]" />} tone="lavanda" label={`Entregas (${word})`} value={courier.deliveries} hint={position > 0 ? `Puesto ${position} de ${rows.filter((row) => row.deliveries > 0).length} con entregas` : "Sin entregas en el periodo"} /></li>
        <li><KpiCard icon={<Route className="size-[18px]" />} label={`Kilómetros (${word})`} value={formatKm(courier.km)} hint="Ruta tienda → cliente" /></li>
        <li><KpiCard icon={<Clock className="size-[18px]" />} label="Tiempo promedio" value={formatMinutes(courier.avgMinutes)} hint="De «en camino» a «entregado»" /></li>
        <li><KpiCard icon={<Truck className="size-[18px]" />} label="Pedidos en curso" value={courier.activeOrders} hint="Asignados que aún no entrega" /></li>
        <li><KpiCard icon={<Banknote className="size-[18px]" />} tone="durazno" label="Efectivo por rendir" value={formatMoney(courier.cashPending)} hint={courier.cashPendingOrders > 0 ? `${courier.cashPendingOrders} ${courier.cashPendingOrders === 1 ? "entrega" : "entregas"} sin recibir en caja` : "Nada pendiente"} /></li>
      </ul>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Entregas por día" subtitle={period.days > 1 ? period.label : "Elige 7 días, Quincena o Mes para ver la tendencia"} />
          {period.days > 1 ? <LineChart ariaLabel={`Entregas por día, ${period.label}`} labels={labels} series={[{ name: "Entregas", tone: "hoja", values: deliveriesSeries }]} /> : null}
        </Card>
        <Card className="p-5">
          <CardHeader title="Kilómetros por día" subtitle={period.days > 1 ? "Ruta tienda → cliente de lo entregado" : "Elige 7 días, Quincena o Mes para ver la tendencia"} />
          {period.days > 1 ? <LineChart ariaLabel={`Kilómetros por día, ${period.label}`} labels={labels} formatValue={(n) => formatKm(n)} series={[{ name: "Kilómetros", tone: "marino", values: kmSeries }]} /> : null}
        </Card>
      </div>

      <Card className="mb-5 p-5">
        <CardHeader title="Pedidos recientes" subtitle="Los últimos 15 pedidos asignados, entregados o en curso" />
        <DataTable
          caption="Pedidos del repartidor"
          columns={[
            { header: "Pedido", cell: (row) => <span className="font-bold">#{row.number}</span> },
            { header: "Tienda", cell: (row) => row.store },
            { header: "Total", cell: (row) => <span className="tabular-nums">{formatMoney(row.total)}</span> },
            { header: "Pago", cell: (row) => row.payment },
            { header: "Estado", cell: (row) => <Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge> },
            { header: "Fecha", cell: (row) => row.at },
          ]}
          rows={recent}
          rowKey={(row) => row.id}
          emptyTitle="Todavía no tiene pedidos"
          emptyHint="Aparecen cuando la coordinación le asigna un pedido."
        />
      </Card>
      {manage}
    </>
  );
}

