import { Alert, Card, CardHeader, DataTable, DonutChart, EmptyState, HBarList, KpiCard, LineChart, buttonStyles } from "@rapitrip/ui";
import { Ban, Banknote, FileText, Mail, PackageCheck, ShieldCheck, Timer, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AttentionRow } from "@/components/attention-row";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { StalledOrders } from "@/components/stalled-orders";
import { StoreFilter } from "@/components/store-filter";
import { compactMoney, fillDays, firstDays, parsePeriod, periodOptions, projectMonthEnd, trendOf } from "@/lib/dashboard";
import { first, optionalUuid, type SearchParams } from "@/lib/filters";
import { timeAgo } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { orderStatuses, orderStatusLabel } from "@/lib/orders";
import { salesShare } from "@/lib/sales-share";
import { overdueSummary } from "@/lib/sla-overview";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Inicio" };

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string) {
  const { count: total, error } = await query;
  if (error) console.error(`[inicio:${label}]`, error.message);
  return error ? null : (total ?? 0);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
export default async function AdminHome({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const session = await requireConsoleAccess("admin");
  const period = parsePeriod(first(params.periodo));
  const store = optionalUuid.parse(first(params.tienda));
  const supabase = await serverSupabase();
  const head = { count: "exact", head: true } as const;
  const range = { p_from: period.from, p_to: period.to, p_store: store };
  const [profile, requests, invitations, incidents, commerces, stores, current, previous, byStatus, byStore, overdue, rejections, pending, storeOwners, commerceNames, stalled] = await Promise.all([
    supabase.from("my_profile").select("full_name").maybeSingle(),
    count(supabase.from("commerce_requests_list").select("*", head).eq("status", "pendiente"), "solicitudes"),
    count(supabase.from("invitations_list").select("*", head).eq("status", "pendiente"), "invitaciones"),
    count(supabase.from("it_incidents_list").select("*", head).neq("status", "resuelto"), "incidentes"),
    count(supabase.from("commerces_list").select("*", head).eq("status", "activo"), "comercios"),
    supabase.from("stores_list").select("id, name").eq("status", "activa").order("name"),
    supabase.rpc("sales_by_day", range),
    supabase.rpc("sales_by_day", { p_from: period.prevFrom, p_to: period.prevTo, p_store: store }),
    supabase.rpc("orders_by_status", range),
    supabase.rpc("sales_by_store", { p_from: period.from, p_to: period.to }),
    supabase.rpc("overdue_confirmations"),
    supabase.rpc("repeat_rejections"),
    supabase.from("commerce_requests_list").select("id, business_name, created_at").eq("status", "pendiente").order("created_at", { ascending: false }).limit(5),
    // Para sumar las ventas de cada comercio: a qué comercio pertenece cada tienda (también las cerradas) y su nombre.
    supabase.from("stores_list").select("id, commerce_id"),
    supabase.from("commerces_list").select("id, name"),
    supabase.rpc("stalled_orders"),
  ]);
  // Plazos del manual de políticas de TI que ya vencieron (las eliminaciones las atiende solo la dirección).
  const overdueSla = await overdueSummary(supabase, { includeDeletions: session.role === "superadmin" });
  const queryErrors = [stores, current, previous, byStatus, byStore, overdue, rejections, pending, storeOwners, commerceNames, stalled].flatMap((result) => (result.error ? [result.error.message] : []));
  if (queryErrors.length > 0) console.error("[inicio:cifras]", queryErrors.join(" | "));
  const failed = queryErrors.length > 0 || [requests, invitations, incidents, commerces].some((value) => value === null);

  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const currentRows = current.data ?? [];
  const previousRows = previous.data ?? [];
  const orders = sum(currentRows.map((row) => Number(row.orders)));
  const sales = sum(currentRows.map((row) => Number(row.sales)));
  const statusRows = byStatus.data ?? [];
  const cancelled = Number(statusRows.find((row) => row.status === "cancelado")?.orders ?? 0);
  const allOrders = sum(statusRows.map((row) => Number(row.orders)));

  // Serie del periodo hasta hoy contra el periodo anterior completo; el eje lo marca el periodo entero.
  const todayEnd = parsePeriod("hoy").to;
  const upTo = period.to < todayEnd ? period.to : todayEnd;
  const labels = fillDays([], period.from, period.to).map((point) => point.day.slice(8));
  const currentSeries = fillDays(currentRows.map((row) => ({ day: row.day, value: Number(row.sales) })), period.from, upTo);
  const previousSeries = fillDays(previousRows.map((row) => ({ day: row.day, value: Number(row.sales) })), period.prevFrom, period.from).slice(0, labels.length);
  // La variación compara con lo equivalente: los mismos días transcurridos del periodo anterior, no el periodo anterior completo.
  const comparable = firstDays(previousRows, period.prevFrom, currentSeries.length);
  const prevOrders = sum(comparable.map((row) => Number(row.orders)));
  const prevSales = sum(comparable.map((row) => Number(row.sales)));
  const best = currentSeries.reduce<{ day: string; value: number } | null>((top, point) => (point.value > (top?.value ?? 0) ? point : top), null);
  const dailyAverage = currentSeries.length > 0 ? sales / currentSeries.length : 0;
  const vs = period.key === "mes" ? "el mes anterior" : period.key === "quincena" ? "la quincena anterior" : period.key === "7d" ? "los 7 días anteriores" : "ayer";
  const periodWord = period.key === "hoy" ? "hoy" : period.key === "7d" ? "7 días" : period.key === "quincena" ? "esta quincena" : "este mes";

  // Estados con pedidos, en el orden del flujo: barras horizontales para que cada nombre se lea completo.
  const statusBars = orderStatuses.flatMap((status) => {
    const orders = Number(statusRows.find((row) => row.status === status)?.orders ?? 0);
    return orders > 0 ? [{ label: orderStatusLabel[status], value: orders, tone: status === "cancelado" || status === "rechazado" ? ("marino" as const) : ("hoja" as const) }] : [];
  });
  const commerceSlices = salesShare(byStore.data ?? [], storeOwners.data ?? [], commerceNames.data ?? []);
  const overdueCount = Number(overdue.data ?? 0);
  const repeat = rejections.data ?? [];
  const pendingRows = (pending.data ?? []).flatMap((row) => (row.id ? [{ id: row.id, name: row.business_name ?? "Sin nombre", ago: timeAgo(row.created_at) }] : []));

  const kpis = [
    { icon: <PackageCheck className="size-[18px]" />, tone: "menta", label: `Pedidos (${periodWord})`, value: orders, trend: trendOf(orders, prevOrders, vs) },
    { icon: <Banknote className="size-[18px]" />, tone: "lavanda", label: `Ventas (${periodWord})`, value: formatMoney(sales), trend: trendOf(sales, prevSales, vs) },
    { icon: <Ban className="size-[18px]" />, tone: "durazno", label: "Cancelaciones", value: cancelled, hint: allOrders > 0 ? `${Math.round((cancelled / allOrders) * 100)} % de ${allOrders} pedidos` : "Sin pedidos en el periodo" },
  ] as const;

  const attention = [
    requests ? { href: "/admin/solicitudes", icon: <FileText className="size-[18px]" />, text: `${plural(requests, "solicitud pendiente de comercio o vendedor", "solicitudes pendientes de comercios y vendedores")}` } : null,
    incidents ? { href: "/admin/incidentes", icon: <ShieldCheck className="size-[18px]" />, text: `${plural(incidents, "incidente de TI sin resolver", "incidentes de TI sin resolver")}` } : null,
    invitations ? { href: "/admin/usuarios", icon: <Mail className="size-[18px]" />, text: `${plural(invitations, "invitación esperando respuesta", "invitaciones esperando respuesta")}` } : null,
    overdueSla.devoluciones ? { href: "/admin/devoluciones", icon: <Timer className="size-[18px]" />, text: `${plural(overdueSla.devoluciones, "devolución pasó", "devoluciones pasaron")} los 3 días hábiles para decidir` } : null,
    overdueSla.eliminaciones ? { href: "/admin/datos-personales", icon: <Timer className="size-[18px]" />, text: `${plural(overdueSla.eliminaciones, "solicitud de eliminación pasó", "solicitudes de eliminación pasaron")} los 30 días` } : null,
    overdueSla.incidentes ? { href: "/admin/incidentes", icon: <Timer className="size-[18px]" />, text: `${plural(overdueSla.incidentes, "falla del sistema pasó", "fallas del sistema pasaron")} su plazo de corrección` } : null,
    overdueSla.incidencias ? { href: "/coordinacion", icon: <Timer className="size-[18px]" />, text: `${plural(overdueSla.incidencias, "aviso de repartidor lleva", "avisos de repartidores llevan")} más de 30 minutos sin resolver` } : null,
  ].filter((item) => item !== null);

  return (
    <>
      <PageHeader title={firstName ? `Hola, ${firstName}` : "Hola"} description="Cómo va la operación de Rapitrip." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterChips basePath="/admin" param="periodo" current={period.key} options={periodOptions} keep={{ tienda: store }} />
        <StoreFilter basePath="/admin" stores={(stores.data ?? []).flatMap((row) => (row.id && row.name ? [{ id: row.id, name: row.name }] : []))} current={store} keep={{ periodo: period.key }} />
      </div>
      {failed ? <Alert tone="error" className="mb-5">Algunos indicadores no se pudieron cargar. Recarga la página.</Alert> : null}
      <StalledOrders rows={stalled.data ?? []} basePath="/admin/pedidos" />
      {overdueCount > 0 || repeat.length > 0 ? (
        <Alert tone="warning" className="mb-5">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {overdueCount > 0 ? (
              <Link href="/admin/excepciones" className="font-bold underline">
                {plural(overdueCount, "confirmación vencida", "confirmaciones vencidas")}
              </Link>
            ) : null}
            {repeat.map((row) => (
              <span key={row.commerce_id}>
                <TriangleAlert aria-hidden="true" className="mr-1 inline size-4" />
                {row.store_name ?? "Un comercio"}: {plural(Number(row.rejections), "pedido rechazado", "pedidos rechazados")} esta semana
              </span>
            ))}
          </span>
        </Alert>
      ) : null}
      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <li key={kpi.label}>
            <KpiCard icon={kpi.icon} tone={kpi.tone} label={kpi.label} value={kpi.value} hint={"hint" in kpi ? kpi.hint : undefined} trend={"trend" in kpi ? kpi.trend : undefined} />
          </li>
        ))}
        <li>
          <Link href="/admin/solicitudes" className="group block h-full rounded-tarjeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
            <KpiCard icon={<FileText className="size-[18px]" />} tone="menta" label="Solicitudes pendientes" value={requests ?? "—"} hint="Comercios que esperan respuesta" />
          </Link>
        </li>
      </ul>

      <Card outerClassName="mb-5" className="p-5">
        <CardHeader title="Ventas por día" subtitle={period.days > 1 ? `${period.label} contra ${vs}` : "Elige 7 días, Quincena o Mes para ver la tendencia"} />
        {period.days > 1 ? (
          <>
            <LineChart
              ariaLabel={`Ventas por día, ${period.label}`}
              labels={labels}
              formatValue={compactMoney}
              series={[
                { name: "Periodo actual", tone: "hoja", values: currentSeries.map((point) => point.value) },
                { name: "Periodo anterior", tone: "gris", dashed: true, values: previousSeries.map((point) => point.value) },
              ]}
            />
            <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-campo bg-crema px-3 py-2">
                <dt className="text-micro font-bold uppercase text-tinta-suave">Mejor día</dt>
                <dd className="font-bold text-tinta">{best ? `${best.day.slice(8)}/${best.day.slice(5, 7)} · ${formatMoney(best.value)}` : "—"}</dd>
              </div>
              <div className="rounded-campo bg-crema px-3 py-2">
                <dt className="text-micro font-bold uppercase text-tinta-suave">Promedio diario</dt>
                <dd className="font-bold text-tinta">{formatMoney(dailyAverage)}</dd>
              </div>
              {period.key === "mes" ? (
                <div className="rounded-campo bg-crema px-3 py-2">
                  <dt className="text-micro font-bold uppercase text-tinta-suave">Proyección de fin de mes</dt>
                  <dd className="font-bold text-tinta">{formatMoney(projectMonthEnd(sales))}</dd>
                  <dd className="text-xs text-tinta-suave">Estimación con el promedio diario</dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : null}
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Pedidos por estado" subtitle="Dónde está cada pedido del periodo, en el orden del flujo" />
          {statusBars.length > 0 ? <HBarList items={statusBars} /> : <p className="py-6 text-center text-sm text-tinta-suave">Sin pedidos en el periodo</p>}
        </Card>
        <Card className="p-5">
          <CardHeader title="Ventas por comercio" subtitle="Qué parte de las ventas del periodo hace cada comercio" />
          <DonutChart items={commerceSlices} ariaLabel={`Ventas por comercio, ${period.label}`} totalLabel="ventas" formatValue={compactMoney} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Solicitudes pendientes" />
          <DataTable
            caption="Solicitudes pendientes"
            columns={[
              { header: "Negocio", cell: (row) => <span className="font-bold text-tinta">{row.name}</span> },
              { header: "Recibida", cell: (row) => row.ago },
            ]}
            rows={pendingRows}
            rowKey={(row) => row.id}
            emptyTitle="Todo al día"
            emptyHint="No hay solicitudes pendientes."
          />
          {pendingRows.length > 0 ? (
            <Link href="/admin/solicitudes" className={buttonStyles({ variant: "secondary", className: "mt-3" })}>
              Revisar solicitudes
            </Link>
          ) : null}
        </Card>
        <Card className="p-5">
          <CardHeader title="Requiere tu atención" />
          {attention.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {attention.map((item) => (
                <li key={item.href}>
                  <AttentionRow href={item.href} icon={item.icon}>
                    {item.text}
                  </AttentionRow>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Todo al día">No hay solicitudes, incidentes ni invitaciones pendientes.</EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}

