"use client";

import { Alert, Badge, Button, Card, SelectField, cn } from "@rapitrip/ui";
import { ArrowLeft, Banknote, History, MapPin, Package, Phone, Send, StickyNote, Truck, UserRound, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { CodeResetPanel, IssuesPanel } from "@/components/delivery-issues";
import { OfferPanel } from "@/components/offer-panel";
import { OrderRoute } from "@/components/order-route";
import { OrderTrace } from "@/components/order-trace";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { courierFits } from "@/lib/courier-fit";
import { classLabel, etaText } from "@/lib/delivery-class";
import { formatMoney } from "@/lib/money";
import { useNow } from "@/lib/use-now";
import type { RouteResult } from "@/lib/order-route";
import { coordActions, coordTab, orderStatusLabel, orderStatusTone, paymentLabel, type CoordAction } from "@/lib/orders";
import { OfferBadge, useAutoRefresh, type Courier, type CourierAppActions, type DispatchOrder } from "../../dispatch-workspace";

type Props = {
  row: DispatchOrder;
  couriers: Courier[];
  setStatus: (id: string, input: { to: string; reason?: string }) => Promise<ActionResult>;
  assign: (id: string, courierId: string) => Promise<ActionResult>;
  reclassify: (id: string, reason: string) => Promise<ActionResult>;
  loadRoute: (id: string) => Promise<RouteResult>;
  courierApp?: CourierAppActions;
};

/**
 * Ficha de despacho de un pedido: arriba quién, qué y cuánto; en el centro productos, entrega y lo que pasa con el repartidor;
 * a la derecha las acciones (despachar, entregar, cancelar, reclasificar) y la asignación del repartidor.
 */
export function DispatchDetail({ row, couriers, setStatus, assign, reclassify, loadRoute, courierApp }: Props) {
  const router = useRouter();
  const now = useNow();
  useAutoRefresh();
  const [courier, setCourier] = useState(row.courierId ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [asking, setAsking] = useState<CoordAction | null>(null);
  // Despachar o entregar por un repartidor con cuenta sin su evidencia exige un motivo: la base de datos lo avisa y aquí se pide.
  const [skipping, setSkipping] = useState<CoordAction | null>(null);
  const [reclassifying, setReclassifying] = useState(false);
  const [pending, start] = useTransition();
  const actions = coordActions(row.status);
  const canAssign = ["confirmado", "preparando", "listo", "en_camino"].includes(row.status);
  const assigned = row.courierId !== null;
  // Solo se ofrecen los repartidores que pueden llevar este pedido (la base de datos vuelve a comprobarlo al asignar).
  const eligible = couriers.filter((item) => courierFits(row, item).ok);
  const canReclassify = row.deliveryClass === "express" && ["por_confirmar", "confirmado", "preparando", "listo"].includes(row.status);
  const assignedCourier = couriers.find((item) => item.id === row.courierId) ?? null;
  const units = row.items.reduce((sum, item) => sum + item.quantity, 0);
  const tab = coordTab(row.status);

  function saveCourier() {
    setMessage(null);
    start(async () => {
      const result = await assign(row.id, courier);
      setMessage(result.ok ? { ok: true, text: "Repartidor asignado." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  function run(action: CoordAction) {
    setMessage(null);
    start(async () => {
      const result = await setStatus(row.id, { to: action.to });
      if (!result.ok && /falta la evidencia/i.test(result.error)) return setSkipping(action);
      setMessage(result.ok ? { ok: true, text: `Pedido ${row.number}: ${orderStatusLabel[action.to].toLowerCase()}.` } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <>
      <Link href={tab === "listos" ? "/coordinacion" : `/coordinacion?vista=${tab}`} className="-ml-3 mb-3 inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] font-bold text-hoja hover:bg-menta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Pedidos
      </Link>

      <div className="flex flex-col gap-5">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-menta to-bruma text-hoja ring-1 ring-borde">
                <Truck className="size-7" />
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge>
                  <Badge tone={row.deliveryClass === "express" ? "positive" : "neutral"}>{classLabel(row.deliveryClass)}</Badge>
                  <OfferBadge row={row} now={now} />
                  {(row.issues ?? []).length > 0 ? <Badge tone="warning">Aviso del repartidor</Badge> : null}
                </div>
                <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-tinta">Pedido {row.number}</h1>
                <p className="truncate text-[13px] text-tinta-suave">
                  {row.store} · {row.createdAt}
                </p>
              </div>
            </div>
            <dl className="grid shrink-0 grid-cols-3 gap-2 lg:flex lg:gap-2.5">
              <Stat label="Total" value={formatMoney(row.total)} strong />
              <Stat label="Productos" value={`${units} u.`} />
              <Stat label="Pago" value={paymentLabel(row.paymentMethod, row.paymentStatus)} />
            </dl>
          </div>
        </Card>

        {row.reason ? <Alert tone="warning">Motivo: {row.reason}</Alert> : null}

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="p-5 sm:p-6">
              <Heading icon={<MapPin className="size-[18px]" />} tone="lavanda" title="Entrega" subtitle={etaText(row.deliveryClass, row.etaMinDays, row.etaMaxDays)} />
              {row.address ? (
                <div className="mb-4 grid grid-cols-1 gap-2.5 rounded-panel bg-crema/70 p-4 text-sm ring-1 ring-borde sm:grid-cols-2">
                  <p className="flex items-start gap-2 text-tinta sm:col-span-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-tinta-suave" aria-hidden="true" />
                    {row.address}
                  </p>
                  <p className="flex items-center gap-2 text-tinta">
                    <Phone className="size-4 shrink-0 text-tinta-suave" aria-hidden="true" />
                    {row.phone}
                  </p>
                  {row.notes ? (
                    <p className="flex items-start gap-2 text-tinta-suave">
                      <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      Nota: {row.notes}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mb-4 text-[13px] text-tinta-suave">Sin datos de entrega.</p>
              )}
              {row.deliveryClass === "programado" ? <Alert className="mb-4">Pedido programado: lo lleva un repartidor con vehículo{row.originDepartment ? " del departamento de la tienda" : ""}.</Alert> : null}
              {row.reclassifiedReason ? <Alert tone="warning" className="mb-4">Reclasificado a programado: {row.reclassifiedReason}</Alert> : null}
              {row.address ? <OrderRoute orderId={row.id} load={loadRoute} /> : null}
            </Card>

            {courierApp ? (
              <Card className="p-5 sm:p-6">
                <Heading icon={<Send className="size-[18px]" />} title="Repartidor y aplicación" subtitle="Propuestas al repartidor, sus avisos y los códigos de recogida y entrega." />
                <IssuesPanel issues={row.issues ?? []} resolve={courierApp.resolveIssue} onReclassify={canReclassify ? () => setReclassifying(true) : undefined} />
                <OfferPanel orderId={row.id} canOffer={!assigned && ["confirmado", "preparando", "listo"].includes(row.status)} offers={row.offers ?? []} loadOfferable={courierApp.loadOfferable} offer={courierApp.offer} cancel={courierApp.cancelOffer} />
                {row.courierHasAccount && (row.status === "listo" || row.status === "en_camino") ? (
                  <Alert className="mb-3.5">
                    {assignedCourier?.name ?? "El repartidor"} usa la aplicación: él registra la {row.status === "listo" ? "recogida" : "entrega"} con foto y código. Solo despacha o entrega por él si no puede hacerlo, y deja el motivo.
                  </Alert>
                ) : null}
                {row.courierId && row.courierHasAccount && (row.status === "listo" || row.status === "en_camino") ? <CodeResetPanel orderId={row.id} reset={courierApp.resetCode} /> : null}
              </Card>
            ) : null}

            <Card className="p-5 sm:p-6">
              <Heading icon={<Package className="size-[18px]" />} title="Productos" subtitle={`${row.items.length} ${row.items.length === 1 ? "línea" : "líneas"} · ${units} ${units === 1 ? "unidad" : "unidades"}`} />
              <ul className="flex flex-col divide-y divide-borde rounded-panel bg-papel ring-1 ring-borde">
                {row.items.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-crema text-[12.5px] font-extrabold tabular-nums text-tinta">{item.quantity}×</span>
                      <span className="truncate font-semibold text-tinta">{item.name}</span>
                    </span>
                    <span className="font-bold tabular-nums text-tinta">{formatMoney(item.total)}</span>
                  </li>
                ))}
              </ul>
              <dl className="ml-auto mt-4 grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-tinta-suave">Subtotal</dt>
                <dd className="text-right tabular-nums">{formatMoney(row.subtotal)}</dd>
                <dt className="text-tinta-suave">Envío</dt>
                <dd className="text-right tabular-nums">{formatMoney(row.deliveryFee)}</dd>
                <dt className="border-t border-borde pt-1.5 font-bold text-tinta">Total</dt>
                <dd className="border-t border-borde pt-1.5 text-right text-[16px] font-extrabold tabular-nums text-tinta">{formatMoney(row.total)}</dd>
              </dl>
            </Card>

            {courierApp ? (
              <Card className="p-5 sm:p-6">
                <Heading icon={<History className="size-[18px]" />} tone="durazno" title="Historial y evidencias" subtitle="Cada cambio de estado, las fotos de recogida y entrega y el cobro." />
                <div className="flex flex-col">
                  <OrderTrace orderId={row.id} load={courierApp.loadTrace} />
                </div>
              </Card>
            ) : null}
          </div>

          <div className="flex flex-col gap-5 xl:sticky xl:top-6">
            <Card className="p-5">
              <Heading icon={<Zap className="size-[18px]" />} title="Acciones" subtitle={actions.length > 0 ? "El siguiente paso del pedido." : undefined} />
              <div className="flex flex-col gap-3">
                {actions.length > 0 ? (
                  <>
                    {actions.map((action, index) => (
                      <Button key={action.to} variant={index === 0 ? "primary" : "danger"} className="w-full" disabled={pending || (action.needsCourier === true && !assigned)} onClick={() => (action.reason ? setAsking(action) : run(action))}>
                        {action.label}
                      </Button>
                    ))}
                    {actions.some((a) => a.needsCourier) && !assigned ? <p className="text-xs text-tinta-suave">Asigna un repartidor para poder despachar.</p> : null}
                  </>
                ) : (
                  <p className="text-[12.5px] text-tinta-suave">Este pedido ya terminó.</p>
                )}
                {canReclassify ? (
                  <div className="border-t border-borde pt-3">
                    <Button variant="secondary" className="w-full" disabled={pending} onClick={() => setReclassifying(true)}>
                      Reclasificar a programado
                    </Button>
                    <p className="mt-1.5 text-xs text-tinta-suave">Úsalo si el pedido no cabe en una moto. Se le quita el repartidor y pasa a vehículo.</p>
                  </div>
                ) : null}
                {message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}
              </div>
            </Card>

            <Card className="p-5">
              <Heading icon={<UserRound className="size-[18px]" />} tone="lavanda" title="Repartidor" />
              {assignedCourier ? (
                <div className="mb-3 flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-sm font-bold text-hoja">
                    {assignedCourier.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-tinta">{assignedCourier.name}</p>
                    <p className="truncate text-xs text-tinta-suave">{[assignedCourier.vehicle, assignedCourier.phone].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ) : (
                <p className="mb-3 rounded-panel border border-dashed border-borde-campo px-4 py-3 text-center text-[13px] font-semibold text-tinta-suave">Sin repartidor</p>
              )}
              {canAssign ? (
                <div className="flex flex-col gap-2.5">
                  <SelectField label={courierApp ? "Asignar directamente (excepción)" : "Repartidor"} value={courier} onChange={(e) => setCourier(e.target.value)}>
                    <option value="">{eligible.length === 0 ? "No hay repartidores compatibles" : "Elige un repartidor"}</option>
                    {eligible.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.vehicle ? ` · ${item.vehicle}` : ""}
                        {courierApp && item.hasAccount === false ? " · sin cuenta" : ""}
                      </option>
                    ))}
                  </SelectField>
                  {eligible.length < couriers.length ? (
                    <p className="text-xs text-tinta-suave">
                      {couriers.length - eligible.length} repartidor(es) activos no aparecen porque no pueden llevar este pedido
                      {row.deliveryClass === "programado" ? " (se necesita un vehículo del departamento de la tienda)" : ""}.
                    </p>
                  ) : null}
                  <Button variant="secondary" onClick={saveCourier} disabled={pending || !courier || courier === row.courierId} className="w-full">
                    {assigned ? "Cambiar repartidor" : "Asignar repartidor"}
                  </Button>
                </div>
              ) : null}
            </Card>

            <Card className="p-5">
              <Heading icon={<Banknote className="size-[18px]" />} tone="durazno" title="Pago" />
              <p className={cn("text-sm font-bold text-tinta")}>{paymentLabel(row.paymentMethod, row.paymentStatus)}</p>
              {row.paymentMethod === "efectivo" ? <Alert tone="warning" className="mt-3">El repartidor cobra {formatMoney(row.total)} en efectivo al entregar.</Alert> : null}
            </Card>
          </div>
        </div>
      </div>

      {skipping ? (
        <ReasonDialog
          open
          onClose={() => setSkipping(null)}
          title={`${skipping.label} sin la evidencia completa`}
          description="El repartidor aún no registró la foto o el código de este paso. Si continúas, queda anotado en el pedido y en la auditoría."
          confirmLabel={skipping.label}
          onConfirm={(reason) => setStatus(row.id, { to: skipping.to, reason })}
        />
      ) : null}
      {reclassifying ? (
        <ReasonDialog
          open
          onClose={() => setReclassifying(false)}
          title={`Reclasificar pedido ${row.number}`}
          description="Pasa a entrega programada con vehículo. El cliente conserva lo que pagó y se le muestra el nuevo plazo. Queda registrado quién lo hizo y por qué."
          confirmLabel="Reclasificar"
          onConfirm={(reason) => reclassify(row.id, reason)}
        />
      ) : null}
      {asking ? (
        <ReasonDialog
          open
          onClose={() => setAsking(null)}
          title={`${asking.label} ${row.number}`}
          description="Se devuelve el stock. Si ya estaba pagado con tarjeta, se le devuelve el dinero al cliente."
          confirmLabel={asking.label}
          danger
          onConfirm={(reason) => setStatus(row.id, { to: asking.to, reason })}
        />
      ) : null}
    </>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-3.5 py-2.5", strong ? "bg-menta" : "bg-crema")}>
      <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
      <dd className={cn("whitespace-nowrap font-extrabold tabular-nums text-tinta", strong ? "text-[17px]" : "text-[13.5px]")}>{value}</dd>
    </div>
  );
}

function Heading({ icon, title, subtitle, tone = "menta" }: { icon: ReactNode; title: string; subtitle?: string; tone?: "menta" | "lavanda" | "durazno" }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", tone === "menta" ? "bg-menta text-hoja" : tone === "lavanda" ? "bg-lavanda text-marino" : "bg-durazno text-durazno-texto")}>
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-tinta">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[12.5px] leading-snug text-tinta-suave">{subtitle}</p> : null}
      </div>
    </div>
  );
}
