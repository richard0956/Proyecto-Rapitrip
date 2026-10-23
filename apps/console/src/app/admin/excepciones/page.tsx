import { Alert, Badge, Card, CardHeader } from "@rapitrip/ui";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { classifyDeliveryExceptions, exceptionWindows } from "@/lib/delivery-exceptions";
import { classifyExceptions, EXCEPTION_MINUTES, orderStatuses, type ExceptionKind, type ExceptionOrder, type OrderStatus } from "@/lib/orders";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Excepciones" };

const sections: { kind: ExceptionKind; title: string; hint: string }[] = [
  { kind: "sin_repartidor", title: "Listos sin repartidor", hint: "El comercio ya los dejó listos y nadie los ha asignado. Coordinación debe asignar repartidor." },
  { kind: "sin_respuesta", title: "Sin respuesta del comercio", hint: `Llevan más de ${EXCEPTION_MINUTES.sinRespuesta} minutos por confirmar (vencen a los 45).` },
  { kind: "en_camino_largo", title: "En camino hace demasiado", hint: `Llevan más de ${EXCEPTION_MINUTES.enCamino} minutos en camino.` },
  { kind: "reembolso_pendiente", title: "Reembolsos pendientes", hint: "Pedidos pagados con tarjeta que se cancelaron: el reembolso aún no se ha hecho en Stripe." },
];

export default async function ExcepcionesPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [orders, events] = await Promise.all([
    supabase
      .from("orders_list")
      .select("id, number, channel, store_name, status, payment_status, courier_id, updated_at, delivery_class")
      .in("status", ["por_confirmar", "listo", "en_camino", "cancelado", "rechazado"])
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase.from("payment_events_list").select("event_id, order_number, outcome, received_at, for_checkout").order("received_at", { ascending: false }).limit(50),
  ]);
  const { day: since, week } = exceptionWindows();
  const [issueRows, statusRows, evidenceRows, offerRows, couriers] = await Promise.all([
    supabase.from("delivery_issues_list").select("order_id, kind, reason, created_at").eq("status", "abierta").order("created_at", { ascending: false }).limit(100),
    supabase.from("order_evidence_status").select("number, status, complete, order_id").eq("complete", false).limit(100),
    supabase.from("order_evidence_list").select("order_id, kind, taken_at, flagged, flag_reason, distance_m").gte("taken_at", week).order("taken_at", { ascending: false }).limit(500),
    supabase.from("order_offers_list").select("courier_id, status").eq("status", "vencida").gte("offered_at", since).limit(300),
    supabase.from("couriers_list").select("id, full_name"),
  ]);
  const referenced = [...new Set([...(issueRows.data ?? []).map((r) => r.order_id), ...(evidenceRows.data ?? []).map((r) => r.order_id)].filter((id): id is string => Boolean(id)))];
  const numbers = referenced.length ? await supabase.from("orders_list").select("id, number").in("id", referenced) : { data: [], error: null };
  const failed = orders.error || events.error || issueRows.error || statusRows.error || evidenceRows.error || offerRows.error || couriers.error || numbers.error;
  if (failed) console.error("[excepciones]", orders.error?.message, events.error?.message, issueRows.error?.message, statusRows.error?.message, evidenceRows.error?.message, offerRows.error?.message, couriers.error?.message, numbers.error?.message);
  const numberOf = new Map((numbers.data ?? []).flatMap((r) => (r.id && r.number !== null ? [[r.id, Number(r.number)] as const] : [])));
  const courierName = new Map((couriers.data ?? []).flatMap((r) => (r.id ? [[r.id, r.full_name ?? "Repartidor"] as const] : [])));
  const delivery = classifyDeliveryExceptions({
    issues: (issueRows.data ?? []).flatMap((r) => (r.order_id && numberOf.has(r.order_id) && r.kind && r.reason && r.created_at ? [{ number: numberOf.get(r.order_id)!, kind: r.kind, reason: r.reason, at: r.created_at }] : [])),
    statuses: (statusRows.data ?? []).flatMap((r) => (r.number !== null && r.status ? [{ number: Number(r.number), status: r.status, complete: r.complete === true, at: "" }] : [])),
    evidence: (evidenceRows.data ?? []).flatMap((r) => (r.order_id && numberOf.has(r.order_id) && r.kind && r.taken_at ? [{ number: numberOf.get(r.order_id)!, kind: r.kind, at: r.taken_at, flagged: r.flagged === true, flagReason: r.flag_reason, distanceM: r.distance_m }] : [])),
    offers: (offerRows.data ?? []).map((r) => ({ courierName: r.courier_id ? (courierName.get(r.courier_id) ?? "Repartidor") : "Repartidor", status: r.status ?? "" })),
  });
  const deliverySections = [
    { key: "avisos", title: "Avisos de repartidores", hint: "Mensajes que el repartidor mandó desde su teléfono y esperan respuesta de coordinación.", rows: delivery.avisos },
    { key: "incompletas", title: "Sin la evidencia completa", hint: "Pedidos en camino o entregados a los que les falta la foto o el código exigidos. Revisa si coordinación lo saltó con motivo.", rows: delivery.incompletas },
    { key: "marcadas", title: "Fotos por revisar", hint: "Fotos tomadas lejos del punto marcado o sin ubicación (últimos 7 días).", rows: delivery.marcadas },
    { key: "rapidas", title: "Entregas demasiado rápidas", hint: "Pasaron menos de 3 minutos entre la foto de recogida y la de entrega (últimos 7 días).", rows: delivery.rapidas },
  ];

  const stores = new Map<number, string>();
  const rows: ExceptionOrder[] = (orders.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    if (!status || row.number === null || !row.updated_at) return [];
    stores.set(Number(row.number), row.store_name ?? "");
    return [{ number: Number(row.number), status, paymentStatus: row.payment_status, courierId: row.courier_id, updatedAt: row.updated_at, channel: row.channel, deliveryClass: row.delivery_class === "programado" ? ("programado" as const) : ("express" as const) }];
  });
  const found = classifyExceptions(rows);
  const stripe = events.data ?? [];
  const total = Object.values(found).reduce((sum, list) => sum + list.length, 0) + stripe.length + deliverySections.reduce((sum, section) => sum + section.rows.length, 0) + delivery.sinRespuesta.length;

  return (
    <>
      <PageHeader title="Excepciones" description="Lo que está atascado o necesita una mano de la administración." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      {total === 0 && !failed ? <Alert tone="info" className="mb-5">Todo en orden: no hay excepciones abiertas.</Alert> : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.kind} className="p-5">
            <CardHeader title={section.title} actions={<Badge tone={found[section.kind].length > 0 ? "warning" : "positive"}>{found[section.kind].length}</Badge>} />
            <p className="mb-3 text-[12.5px] text-tinta-suave">{section.hint}</p>
            {found[section.kind].length === 0 ? (
              <p className="text-[13px] text-tinta-suave">Ninguno.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {found[section.kind].map((order) => (
                  <li key={order.number}>
                    <Link href={`/admin/pedidos?pedido=${order.number}`} className="flex items-center justify-between gap-3 rounded-campo py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                      <span className="min-w-0">
                        <span className="block font-bold text-tinta">Pedido {order.number}</span>
                        <span className="block truncate text-xs text-tinta-suave">{stores.get(order.number)}</span>
                      </span>
                      <span className="shrink-0 text-xs text-tinta-suave">desde {formatStoreDateTime(order.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        {deliverySections.map((section) => (
          <Card key={section.key} className="p-5">
            <CardHeader title={section.title} actions={<Badge tone={section.rows.length > 0 ? "warning" : "positive"}>{section.rows.length}</Badge>} />
            <p className="mb-3 text-[12.5px] text-tinta-suave">{section.hint}</p>
            {section.rows.length === 0 ? (
              <p className="text-[13px] text-tinta-suave">Ninguno.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-borde">
                {section.rows.map((row, index) => (
                  <li key={`${row.number}-${index}`}>
                    <Link href={`/admin/pedidos?pedido=${row.number}`} className="flex items-center justify-between gap-3 rounded-campo py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                      <span className="min-w-0">
                        <span className="block font-bold text-tinta">Pedido {row.number}</span>
                        <span className="block text-xs text-tinta-suave">{row.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        <Card className="p-5">
          <CardHeader title="Propuestas sin respuesta" actions={<Badge tone={delivery.sinRespuesta.length > 0 ? "warning" : "positive"}>{delivery.sinRespuesta.length}</Badge>} />
          <p className="mb-3 text-[12.5px] text-tinta-suave">Repartidores que dejaron vencer 3 o más propuestas en las últimas 24 horas.</p>
          {delivery.sinRespuesta.length === 0 ? (
            <p className="text-[13px] text-tinta-suave">Ninguno.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {delivery.sinRespuesta.map((row) => (
                <li key={row.courier} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-bold text-tinta">{row.courier}</span>
                  <span className="text-xs text-tinta-suave">{row.count} sin responder</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <CardHeader title="Pagos por reembolsar en Stripe" actions={<Badge tone={stripe.length > 0 ? "danger" : "positive"}>{stripe.length}</Badge>} />
          <p className="mb-3 text-[12.5px] text-tinta-suave">Pagos que llegaron tarde, dobles o de otro monto y cuyo reembolso automático no se completó. Stripe lo reintenta; si persiste, devuélvelo desde el Dashboard de Stripe.</p>
          {stripe.length === 0 ? (
            <p className="text-[13px] text-tinta-suave">Ninguno.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borde">
              {stripe.map((event) => (
                <li key={event.event_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-bold text-tinta">{event.order_number ? `Pedido ${event.order_number}` : event.for_checkout ? "Compra con varios pedidos" : "Pedido desconocido"}</span>
                    <span className="block truncate text-xs text-tinta-suave">{event.outcome?.replace("reembolsar_", "pago ")} · {event.event_id}</span>
                  </span>
                  <span className="shrink-0 text-xs text-tinta-suave">{formatStoreDateTime(event.received_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
