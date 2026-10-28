import { Alert, Badge, Card } from "@rapitrip/ui";
import { MapView } from "@rapitrip/maps";
import { Check, Circle, MapPin, Smartphone, StickyNote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/catalog";
import { withinReturnWindow, type ReturnStatus } from "@/lib/returns";
import { classLabel, etaText } from "@/lib/delivery-class";
import { formatMoney } from "@/lib/money";
import { awaitingPaymentConfirmation, customerCanCancel, isFinalStatus, isOrderStatus, orderStatusHint, orderStatusLabel, orderStatusTone, progressIndex, progressSteps, remainingText } from "@/lib/orders";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { startCardPayment } from "../../checkout/actions";
import { cancelOrder, requestReturn } from "../actions";
import { AutoRefresh } from "./auto-refresh";
import { DeliveryCodeCard } from "./delivery-code-card";
import { DeliveryProof, type DeliveryProofData } from "./delivery-proof";
import { OrderActions } from "./order-actions";
import { ReturnForm } from "./return-form";
import { ReturnStatusCard } from "./return-status";
import { PaymentWatch } from "./payment-watch";

export const metadata: Metadata = { title: "Mi pedido", robots: { index: false } };

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua" });

export default async function PedidoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pago?: string }> }) {
  const { id } = await params;
  const { pago } = await searchParams;
  if (!isUuid(id)) notFound();
  await requireCustomer(`/pedidos/${id}`);
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("id").maybeSingle();
  // Las vistas responden vacías si la sesión de un día venció: se confirma con el perfil antes de dar el pedido por inexistente.
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent(`/pedidos/${id}`)}&expirada=1`);

  const { data: order } = await supabase.from("orders_list").select("*").eq("id", id).maybeSingle();
  if (!order || !isOrderStatus(order.status)) notFound();
  const status = order.status;

  const [{ data: items }, { data: events }, { data: delivery }] = await Promise.all([
    supabase.from("order_items_list").select("id, variant_id, product_name, variant_name, unit_price, quantity, line_total").eq("order_id", id).order("product_name"),
    supabase.from("order_events_list").select("id, to_status, reason, created_at").eq("order_id", id).order("id"),
    supabase.from("order_delivery_list").select("address, phone, notes, latitude, longitude").eq("order_id", id).maybeSingle(),
  ]);

  // Un pedido de una compra con tarjeta y varios pedidos se paga junto con los demás, desde la pantalla de la compra.
  const { data: purchase } = order.checkout_id ? await supabase.from("my_checkouts").select("payment_status").eq("id", order.checkout_id).maybeSingle() : { data: null };
  const paidWithPurchase = purchase?.payment_status === "pendiente" || purchase?.payment_status === "pagado";

  const { data: returnRows } = await supabase.rpc("my_return_request", { p_order: id });
  const returnRequest = returnRows?.[0] ?? null;

  // En camino, el cliente ve el código que le dirá al repartidor; ya entregado, ve la foto de su entrega (se conserva 3 meses).
  const { data: deliveryCode } = status === "en_camino" ? await supabase.rpc("my_delivery_code", { p_order: id }) : { data: null };
  let proof: DeliveryProofData | null = null;
  if (status === "entregado") {
    const { data: evidence } = await supabase.from("order_evidence_list").select("file_path, taken_at, purged_at").eq("order_id", id).eq("kind", "entrega").maybeSingle();
    if (evidence) {
      const signed = !evidence.purged_at && evidence.file_path ? await supabase.storage.from("entregas").createSignedUrl(evidence.file_path, 300) : null;
      proof = { url: signed?.data?.signedUrl ?? null, takenAt: evidence.taken_at ? fecha.format(new Date(evidence.taken_at)) : null, purged: Boolean(evidence.purged_at) };
    }
  }

  const waitingPayment = status === "pendiente_pago";
  const left = waitingPayment || status === "por_confirmar" || status === "en_validacion" ? remainingText(order.expires_at) : null;
  const deliveryClass = order.delivery_class === "programado" ? ("programado" as const) : ("express" as const);
  const payExpired = waitingPayment && !left;
  const confirming = awaitingPaymentConfirmation(pago, status);
  const step = progressIndex(status);
  const finalStatus = isFinalStatus(status);

  return (
    <main className="mx-auto max-w-[1180px]">
      {/* Mientras el pedido siga abierto, la pantalla se actualiza sola cada 30 s si la pestaña está visible. */}
      {!finalStatus && !confirming ? <AutoRefresh everyMs={30_000} /> : null}

      <nav aria-label="Ruta de navegación" className="text-[13px] text-tinta-suave">
        <Link href="/pedidos" className="font-bold text-hoja hover:underline">
          Mis pedidos
        </Link>{" "}
        / Pedido {order.number}
      </nav>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta">Pedido {order.number}</h1>
        <Badge tone={orderStatusTone[status]}>{orderStatusLabel[status]}</Badge>
      </div>
      <p className="mt-1 text-[14px] text-tinta-suave">
        {order.store_name} · {order.created_at ? fecha.format(new Date(order.created_at)) : ""}
      </p>
      {!finalStatus ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-tinta">
          <Badge tone={deliveryClass === "express" ? "positive" : "neutral"}>{classLabel({ delivery_class: deliveryClass })}</Badge>
          {etaText({ delivery_class: deliveryClass, eta_min_days: order.eta_min_days ?? null, eta_max_days: order.eta_max_days ?? null })}
          {order.reclassified_at ? <span className="text-tinta-suave">· Lo pasamos a entrega programada porque no cabía en una moto; conservas lo que pagaste.</span> : null}
        </p>
      ) : null}

      <div className="mt-5 flex max-w-3xl flex-col gap-3">
        {confirming ? <PaymentWatch /> : <Alert tone={status === "cancelado" || status === "rechazado" ? "warning" : "info"}>{orderStatusHint[status]}</Alert>}
        {pago === "cancelado" && waitingPayment && !payExpired ? <Alert tone="warning">No se completó el pago. Tu pedido sigue esperando: puedes reintentar o cancelarlo.</Alert> : null}
        {pago === "error" && waitingPayment ? <Alert tone="warning">Tu pedido se creó, pero no pudimos abrir la página de pago. Inténtalo de nuevo con el botón de abajo.</Alert> : null}
        {payExpired ? <Alert tone="warning">El tiempo para pagar venció y el pedido se cancelará en breve; los productos vuelven al inventario. Puedes hacer uno nuevo.</Alert> : null}
        {waitingPayment && left ? <p className="text-[13px] font-bold text-durazno-texto">Te quedan {left} para pagar.</p> : null}
        {status === "por_confirmar" && left ? <p className="text-[13px] text-tinta-suave">El comercio tiene {left} para responder.</p> : null}
        {status === "en_validacion" && left ? <p className="text-[13px] text-tinta-suave">El comercio tiene hasta {left} para terminar de validar tu pedido.</p> : null}
        {order.status_reason && (status === "cancelado" || status === "rechazado") ? <p className="text-[14px] text-tinta">Motivo: {order.status_reason}</p> : null}
        {order.courier_id && !finalStatus ? <p className="text-[13.5px] font-bold text-hoja">Ya hay un repartidor asignado a tu pedido.</p> : null}
        {status === "cancelado" && order.payment_method === "tarjeta" && order.payment_status === "pagado" ? <Alert>Pagaste con tarjeta: el reembolso se procesa automáticamente.</Alert> : null}
      </div>

      {step >= 0 || waitingPayment ? (
        <ol aria-label="Avance del pedido" className="mt-6 grid max-w-3xl grid-cols-3 gap-3 sm:grid-cols-6">
          {progressSteps.map((s, index) => {
            const done = index <= step;
            return (
              <li key={s} aria-current={index === step ? "step" : undefined} className={`flex flex-col items-center gap-1.5 text-center text-[11.5px] font-bold ${done ? "text-hoja" : "text-tinta-suave"}`}>
                <span aria-hidden="true" className={`flex size-8 items-center justify-center rounded-full ${done ? "bg-hoja text-sobre-acento" : "bg-menta/70 text-tinta-suave"}`}>
                  {done ? <Check className="size-4" /> : <Circle className="size-3" />}
                </span>
                {orderStatusLabel[s]}
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          {deliveryCode ? <DeliveryCodeCard code={deliveryCode} /> : null}
          {proof ? <DeliveryProof proof={proof} /> : null}
          <Card className="p-6">
            <h2 className="text-base font-bold text-tinta">Productos</h2>
            <ul className="mt-3 flex flex-col gap-2 text-[14px]">
              {(items ?? []).map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {item.quantity} × {item.product_name} <span className="text-tinta-suave">({item.variant_name})</span>
                  </span>
                  <span className="font-bold">{formatMoney(item.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-1.5 border-t border-borde pt-3 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Subtotal</dt>
                <dd className="font-bold">{formatMoney(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-suave">Envío</dt>
                <dd className="font-bold">{Number(order.delivery_fee) > 0 ? formatMoney(order.delivery_fee) : "Gratis"}</dd>
              </div>
              <div className="flex justify-between border-t border-borde pt-2 text-[16px]">
                <dt className="font-extrabold">Total</dt>
                <dd className="font-extrabold text-hoja">{formatMoney(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[13px] text-tinta-suave">
              Pago: {order.payment_method === "tarjeta" ? "tarjeta" : "efectivo contra entrega"} · {order.payment_status === "pagado" ? "pagado" : order.payment_status === "fallido" ? "fallido" : "pendiente"}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-bold text-tinta">Entrega</h2>
            {delivery ? (
              <ul className="mt-3 flex flex-col gap-2 text-[14px]">
                <li className="flex items-start gap-2">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tinta-suave" />
                  {delivery.address}
                </li>
                <li className="flex items-center gap-2">
                  <Smartphone aria-hidden="true" className="size-4 shrink-0 text-tinta-suave" />
                  {delivery.phone}
                </li>
                {delivery.notes ? (
                  <li className="flex items-start gap-2">
                    <StickyNote aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-tinta-suave" />
                    {delivery.notes}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-tinta-suave">Los datos de entrega ya no están disponibles.</p>
            )}
            {delivery && delivery.latitude != null && delivery.longitude != null ? (
              <div className="mt-4">
                <MapView ariaLabel="Mapa del punto de entrega" markers={[{ id: "destino", label: "Punto de entrega", point: { lat: delivery.latitude, lng: delivery.longitude } }]} />
              </div>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <h2 className="text-base font-bold text-tinta">Acciones</h2>
            {paidWithPurchase && waitingPayment ? (
              <Alert className="mt-3">
                Este pedido se paga junto con el resto de tu compra.{" "}
                <Link href={`/compras/${order.checkout_id}`} className="font-bold underline">
                  Ir a pagar la compra
                </Link>
              </Alert>
            ) : null}
            <div className="mt-3">
              <OrderActions
                orderId={order.id!}
                canCancel={customerCanCancel(status)}
                canPay={waitingPayment && order.payment_method === "tarjeta" && !payExpired && !paidWithPurchase}
                repeat={
                  items && items.length > 0
                    ? { storeId: order.store_id!, storeName: order.store_name ?? "", items: items.filter((i) => i.variant_id).map((i) => ({ variantId: i.variant_id!, quantity: i.quantity ?? 1 })) }
                    : null
                }
                cancel={cancelOrder}
                pay={startCardPayment}
              />
            </div>
          </Card>

          {returnRequest ? (
            <ReturnStatusCard
              status={returnRequest.status as ReturnStatus}
              paymentMethod={order.payment_method === "tarjeta" ? "tarjeta" : "efectivo"}
              reason={returnRequest.reason ?? ""}
              photoCount={Number(returnRequest.photo_count ?? 0)}
              decisionNote={returnRequest.decision_note}
              requestedAt={fecha.format(new Date(returnRequest.requested_at))}
            />
          ) : status === "entregado" && withinReturnWindow(order.delivered_at) && profile.id ? (
            <ReturnForm orderId={order.id!} customerId={profile.id} request={requestReturn} />
          ) : null}

          <Card className="p-6">
            <h2 className="text-base font-bold text-tinta">Historial</h2>
            <ol className="mt-3 flex flex-col gap-3 border-l-2 border-borde pl-4">
              {(events ?? []).map((event) => (
                <li key={event.id} className="relative text-[13.5px]">
                  <span aria-hidden="true" className="absolute -left-[22px] top-1.5 size-2.5 rounded-full bg-hoja" />
                  <p className="font-bold text-tinta">{isOrderStatus(event.to_status) ? orderStatusLabel[event.to_status] : event.to_status}</p>
                  <p className="text-xs text-tinta-suave">{event.created_at ? fecha.format(new Date(event.created_at)) : ""}</p>
                  {event.reason ? <p className="text-xs text-tinta-suave">Motivo: {event.reason}</p> : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </main>
  );
}
