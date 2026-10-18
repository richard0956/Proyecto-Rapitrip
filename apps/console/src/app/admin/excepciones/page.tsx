import { Alert, Badge, Card, CardHeader } from "@rapitrip/ui";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
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
      .select("id, number, channel, store_name, status, payment_status, courier_id, updated_at")
      .in("status", ["por_confirmar", "listo", "en_camino", "cancelado", "rechazado"])
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase.from("payment_events_list").select("event_id, order_number, outcome, received_at").order("received_at", { ascending: false }).limit(50),
  ]);
  const failed = orders.error || events.error;
  if (failed) console.error("[excepciones]", orders.error?.message, events.error?.message);

  const stores = new Map<number, string>();
  const rows: ExceptionOrder[] = (orders.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    if (!status || row.number === null || !row.updated_at) return [];
    stores.set(Number(row.number), row.store_name ?? "");
    return [{ number: Number(row.number), status, paymentStatus: row.payment_status, courierId: row.courier_id, updatedAt: row.updated_at, channel: row.channel }];
  });
  const found = classifyExceptions(rows);
  const stripe = events.data ?? [];
  const total = Object.values(found).reduce((sum, list) => sum + list.length, 0) + stripe.length;

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
                    <span className="block font-bold text-tinta">{event.order_number ? `Pedido ${event.order_number}` : "Pedido desconocido"}</span>
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
