import { Alert, Badge, Card, CardHeader, DataTable, KpiCard, LineChart } from "@rapitrip/ui";
import { Banknote, HandCoins, Receipt, Scale } from "lucide-react";
import Link from "next/link";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { compactMoney, fillDays, parsePeriod, periodOptions } from "@/lib/dashboard";
import { first, type SearchParams } from "@/lib/filters";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Resumen" };

const periods = periodOptions.filter((option) => option.key !== "7d");
const shiftChips = [
  { key: "todos", label: "Todos" },
  { key: "abiertos", label: "Abiertos" },
  { key: "cerrados", label: "Cerrados" },
  { key: "diferencia", label: "Con diferencia" },
];
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export default async function CajaResumen({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await requireConsoleAccess("caja");
  const period = parsePeriod(first(params.periodo));
  const shiftFilter = shiftChips.find((chip) => chip.key === first(params.turno))?.key ?? "todos";
  const supabase = await serverSupabase();

  const [payments, shifts, courierCash, cashReturns] = await Promise.all([
    supabase.rpc("payments_by_day", { p_from: period.from, p_to: period.to }),
    supabase
      .from("cash_sessions_list")
      .select("id, opened_at, closed_at, difference, note, sales_count, sales_total, cash_expected")
      .gte("opened_at", period.from)
      .lt("opened_at", period.to)
      .order("opened_at", { ascending: false })
      .limit(60),
    supabase.rpc("pending_courier_cash"),
    supabase.rpc("pending_cash_returns"),
  ]);
  const errors = [payments, shifts, courierCash, cashReturns].flatMap((result) => (result.error ? [result.error.message] : []));
  if (errors.length > 0) console.error("[caja:resumen]", errors.join(" | "));

  const paymentRows = payments.data ?? [];
  const collected = sum(paymentRows.map((row) => Number(row.total)));
  const pendingCourier = courierCash.data ?? [];
  const pendingReturns = cashReturns.data ?? [];
  const allShifts = (shifts.data ?? []).flatMap((row) =>
    row.id ? [{ id: row.id, openedAt: row.opened_at, closed: Boolean(row.closed_at), difference: row.difference === null ? null : Number(row.difference), note: row.note, salesCount: Number(row.sales_count ?? 0), salesTotal: Number(row.sales_total ?? 0), expected: Number(row.cash_expected ?? 0) }] : [],
  );
  const withDifference = allShifts.filter((row) => row.closed && row.difference !== null && row.difference !== 0);
  const visible = shiftFilter === "abiertos" ? allShifts.filter((row) => !row.closed) : shiftFilter === "cerrados" ? allShifts.filter((row) => row.closed) : shiftFilter === "diferencia" ? withDifference : allShifts;

  const labels = fillDays([], period.from, period.to).map((point) => point.day.slice(8));
  const todayEnd = parsePeriod("hoy").to;
  const upTo = period.to < todayEnd ? period.to : todayEnd;
  const series = (method: string) => fillDays(paymentRows.filter((row) => row.method === method).map((row) => ({ day: row.day, value: Number(row.total) })), period.from, upTo).map((point) => point.value);
  const periodWord = period.key === "hoy" ? "hoy" : period.key === "quincena" ? "esta quincena" : "este mes";

  return (
    <>
      <PageHeader title="Resumen de caja" description="Cuánto entró, qué falta por recibir y qué turnos no cuadraron." />
      <div className="mb-5">
        <FilterChips basePath="/caja/resumen" param="periodo" current={period.key} options={periods} keep={{ turno: shiftFilter === "todos" ? undefined : shiftFilter }} />
      </div>
      {errors.length > 0 ? <Alert tone="error" className="mb-5">No pudimos cargar todas las cifras. Recarga la página.</Alert> : null}
      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard icon={<Banknote className="size-[18px]" />} tone="lavanda" label={`Ventas cobradas (${periodWord})`} value={payments.error ? "—" : formatMoney(collected)} hint="Efectivo y tarjeta de los pedidos confirmados que ves; el efectivo esperado de cada turno está abajo" /></li>
        <li>
          <Link href="/caja" className="group block h-full rounded-tarjeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
            <KpiCard icon={<HandCoins className="size-[18px]" />} tone="durazno" label="Efectivo de repartidores por recibir" value={courierCash.error ? "—" : formatMoney(sum(pendingCourier.map((row) => Number(row.total ?? 0))))} hint={`${pendingCourier.length} ${pendingCourier.length === 1 ? "entrega" : "entregas"} sin rendir`} />
          </Link>
        </li>
        <li><KpiCard icon={<Receipt className="size-[18px]" />} tone="durazno" label="Devoluciones por pagar" value={cashReturns.error ? "—" : formatMoney(sum(pendingReturns.map((row) => Number(row.total ?? 0))))} hint={`${pendingReturns.length} ${pendingReturns.length === 1 ? "devolución" : "devoluciones"} aprobadas en efectivo`} /></li>
        <li><KpiCard icon={<Scale className="size-[18px]" />} label="Turnos con diferencia" value={shifts.error ? "—" : withDifference.length} hint={`Cerrados ${periodWord} con faltante o sobrante`} /></li>
      </ul>

      <Card className="mb-5 p-5">
        <CardHeader title="Ventas por día" subtitle={period.days > 1 ? `Efectivo contra tarjeta, ${period.label.toLowerCase()}` : "Elige Quincena o Mes para ver la tendencia"} />
        {period.days > 1 ? (
          <LineChart
            ariaLabel={`Ventas por día, ${period.label}`}
            labels={labels}
            formatValue={compactMoney}
            series={[
              { name: "Efectivo", tone: "hoja", values: series("efectivo") },
              { name: "Tarjeta", tone: "marino", values: series("tarjeta") },
            ]}
          />
        ) : null}
      </Card>

      <Card className="p-5">
        <CardHeader title="Turnos de caja" subtitle="Para abrir, vender o cerrar un turno, entra a Caja y venta" />
        <div className="mb-3.5">
          <FilterChips basePath="/caja/resumen" param="turno" current={shiftFilter} options={shiftChips.map((chip) => ({ ...chip, count: chip.key === "abiertos" ? allShifts.filter((row) => !row.closed).length : chip.key === "cerrados" ? allShifts.filter((row) => row.closed).length : chip.key === "diferencia" ? withDifference.length : allShifts.length }))} keep={{ periodo: period.key }} />
        </div>
        <DataTable
          caption="Turnos de caja"
          columns={[
            { header: "Abierto", cell: (row) => formatDateTime(row.openedAt) },
            { header: "Estado", cell: (row) => <Badge tone={row.closed ? "neutral" : "positive"}>{row.closed ? "Cerrado" : "Abierto"}</Badge> },
            { header: "Ventas", cell: (row) => <span className="tabular-nums">{row.salesCount}</span> },
            { header: "Total vendido", cell: (row) => <span className="tabular-nums">{formatMoney(row.salesTotal)}</span> },
            { header: "Efectivo esperado", cell: (row) => <span className="tabular-nums">{formatMoney(row.expected)}</span> },
            { header: "Diferencia", cell: (row) => (row.difference === null ? "—" : <Badge tone={row.difference === 0 ? "positive" : "danger"}>{formatMoney(row.difference)}</Badge>) },
            { header: "Nota", cell: (row) => row.note ?? "—" },
          ]}
          rows={visible}
          rowKey={(row) => row.id}
          emptyTitle={shiftFilter === "diferencia" ? "Ningún turno con diferencia" : "No hay turnos en este periodo"}
          emptyHint="Los turnos aparecen aquí al abrirlos en Caja y venta."
        />
      </Card>
    </>
  );
}
