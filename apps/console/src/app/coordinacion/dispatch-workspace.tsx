"use client";

import { Alert, Badge, Button, Card, CardHeader, EmptyState, SelectField, pillStyles } from "@rapitrip/ui";
import { MapPin, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CodeResetPanel, IssuesPanel, type IssueInfo } from "@/components/delivery-issues";
import { OfferPanel, type OfferableCourier } from "@/components/offer-panel";
import { OrderRoute } from "@/components/order-route";
import { OrderTrace } from "@/components/order-trace";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { courierFits, type VehicleClass } from "@/lib/courier-fit";
import { classLabel, etaText, type DeliveryClass } from "@/lib/delivery-class";
import { formatMoney } from "@/lib/money";
import { openOffer, type OfferInfo } from "@/lib/offers";
import type { TraceResult } from "@/lib/order-trace-server";
import type { RouteResult } from "@/lib/order-route";
import { useNow } from "@/lib/use-now";
import { coordActions, coordTab, orderStatusLabel, orderStatusTone, paymentLabel, type CoordAction, type CoordTab, type OrderStatus } from "@/lib/orders";

export type Courier = { id: string; name: string; vehicle: string; phone: string; vehicleClass: VehicleClass | null; department: string | null; available?: boolean; hasAccount?: boolean; push?: boolean };
export type DispatchOrder = {
  id: string;
  number: number;
  store: string;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentStatus: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  courierId: string | null;
  reason: string | null;
  createdAt: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
  items: { name: string; quantity: number; total: number }[];
  deliveryClass: DeliveryClass;
  originDepartment: string | null;
  destinationDepartment: string | null;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  reclassifiedReason: string | null;
  /** Propuestas a repartidores, la más reciente primero. */
  offers?: OfferInfo[];
  /** Avisos abiertos del repartidor. */
  issues?: IssueInfo[];
  /** El repartidor asignado tiene cuenta en la app: su evidencia se completa desde su teléfono. */
  courierHasAccount?: boolean;
};

/** Lo que conecta esta pantalla con la aplicación del repartidor: propuestas, avisos, códigos e historial. */
export type CourierAppActions = {
  loadOfferable: (orderId: string) => Promise<{ ok: true; couriers: OfferableCourier[] } | { ok: false; error: string }>;
  offer: (orderId: string, courierId: string) => Promise<ActionResult>;
  cancelOffer: (offerId: string) => Promise<ActionResult>;
  resolveIssue: (issueId: string, note: string) => Promise<ActionResult>;
  resetCode: (orderId: string, kind: "recogida" | "entrega", reason: string) => Promise<ActionResult>;
  loadTrace: (orderId: string) => Promise<TraceResult>;
};

/** Estado de la propuesta en la fila: esperando respuesta, rechazada o vencida (lo que pide una acción de coordinación). */
function OfferBadge({ row, now }: { row: DispatchOrder; now: number }) {
  const offers = row.offers ?? [];
  if (row.courierId !== null || offers.length === 0) return null;
  const open = openOffer(offers, now);
  if (open) return <Badge tone="warning">Propuesta a {open.courierName}</Badge>;
  const last = offers[0];
  if (last?.status === "rechazada") return <Badge tone="danger">Rechazada por {last.courierName}</Badge>;
  if (last?.status === "vencida" || (last?.status === "pendiente" && new Date(last.expiresAt).getTime() <= now)) return <Badge tone="danger">Sin respuesta de {last.courierName}</Badge>;
  return null;
}

const tabs: { key: CoordTab; label: string; empty: string }[] = [
  { key: "listos", label: "Para despachar", empty: "No hay pedidos listos esperando repartidor." },
  { key: "camino", label: "En camino", empty: "No hay entregas en camino." },
  { key: "preparacion", label: "En preparación", empty: "Ningún comercio está preparando pedidos." },
  { key: "espera", label: "Por confirmar", empty: "No hay pedidos esperando respuesta o pago." },
  { key: "terminados", label: "Terminados", empty: "Todavía no hay pedidos terminados." },
];

type Props = {
  rows: DispatchOrder[];
  couriers: Courier[];
  setStatus: (id: string, input: { to: string; reason?: string }) => Promise<ActionResult>;
  assign: (id: string, courierId: string) => Promise<ActionResult>;
  reclassify: (id: string, reason: string) => Promise<ActionResult>;
  loadRoute: (id: string) => Promise<RouteResult>;
  courierApp?: CourierAppActions;
};

export function DispatchWorkspace({ rows, couriers, setStatus, assign, reclassify, loadRoute, courierApp }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<CoordTab>("listos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const now = useNow();

  // Los pedidos van cambiando de manos: se refresca cada 30 segundos mientras la pestaña está visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const count = (key: CoordTab) => rows.filter((row) => coordTab(row.status) === key).length;
  const visible = rows.filter((row) => coordTab(row.status) === tab);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const courierName = (id: string | null) => couriers.find((c) => c.id === id)?.name ?? null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card>
        <div role="tablist" aria-label="Estado de los pedidos" className="mb-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={pillStyles(tab === item.key)}>
              {item.label}
              <span className="tabular-nums opacity-90">{count(item.key)}</span>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <EmptyState title="Sin pedidos">{tabs.find((item) => item.key === tab)?.empty}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {visible.map((row) => {
              const active = row.id === selectedId;
              return (
                <li key={row.id}>
                  <button type="button" aria-pressed={active} onClick={() => setSelectedId(active ? null : row.id)} className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-campo px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja ${active ? "bg-menta/50" : "hover:bg-calido/60"}`}>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-tinta">Pedido {row.number}</span>
                      <span className="block truncate text-xs text-tinta-suave">
                        {row.store} · {row.address ?? "Sin dirección"}
                      </span>
                      <span className="block text-xs text-tinta-suave">{courierName(row.courierId) ? `Repartidor: ${courierName(row.courierId)}` : "Sin repartidor"}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <OfferBadge row={row} now={now} />
                      {(row.issues ?? []).length > 0 ? <Badge tone="warning">Aviso del repartidor</Badge> : null}
                      <span className="text-sm font-bold tabular-nums text-tinta">{formatMoney(row.total)}</span>
                      <Badge tone={row.deliveryClass === "express" ? "positive" : "neutral"}>{classLabel(row.deliveryClass)}</Badge>
                      <Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {selected ? (
        <DispatchDetail key={selected.id} row={selected} couriers={couriers} setStatus={setStatus} assign={assign} reclassify={reclassify} loadRoute={loadRoute} courierApp={courierApp} onMoved={(to) => setTab(coordTab(to))} />
      ) : (
        <Card>
          <CardHeader title="Detalle del pedido" />
          <EmptyState title="Ninguno elegido">Selecciona un pedido para asignar repartidor o despacharlo.</EmptyState>
        </Card>
      )}
    </div>
  );
}

function DispatchDetail({ row, couriers, setStatus, assign, reclassify, loadRoute, courierApp, onMoved }: Omit<Props, "rows"> & { row: DispatchOrder; onMoved: (to: OrderStatus) => void }) {
  const router = useRouter();
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
      if (result.ok) {
        onMoved(action.to);
        router.refresh();
      }
    });
  }

  return (
    <Card outerClassName="xl:sticky xl:top-6" className="p-5">
      <CardHeader title={`Pedido ${row.number}`} subtitle={`${row.store} · ${row.createdAt}`} actions={<Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge>} />

      <div className="mb-3.5 rounded-panel bg-calido/50 p-3.5 text-sm">
        <p className="mb-1 text-xs font-bold text-tinta-suave">Entrega</p>
        {row.address ? (
          <>
            <p className="flex items-start gap-2 text-tinta">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {row.address}
            </p>
            <p className="mt-1 flex items-center gap-2 text-tinta">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              {row.phone}
            </p>
            {row.notes ? <p className="mt-1 text-xs text-tinta-suave">Nota: {row.notes}</p> : null}
          </>
        ) : (
          <p className="text-tinta-suave">Sin datos de entrega.</p>
        )}
      </div>

      <p className="mb-3.5 flex flex-wrap items-center gap-2 text-sm text-tinta-suave">
        <Badge tone={row.deliveryClass === "express" ? "positive" : "neutral"}>{classLabel(row.deliveryClass)}</Badge>
        {etaText(row.deliveryClass, row.etaMinDays, row.etaMaxDays)}
      </p>
      {row.deliveryClass === "programado" ? (
        <Alert className="mb-3.5">Pedido programado: lo lleva un repartidor con vehículo{row.originDepartment ? " del departamento de la tienda" : ""}.</Alert>
      ) : null}
      {row.reclassifiedReason ? <Alert tone="warning" className="mb-3.5">Reclasificado a programado: {row.reclassifiedReason}</Alert> : null}

      {row.address ? <OrderRoute orderId={row.id} load={loadRoute} /> : null}

      <ul className="mb-3.5 flex flex-col divide-y divide-borde text-sm">
        {row.items.map((item) => (
          <li key={item.name} className="flex items-start justify-between gap-3 py-1.5">
            <span className="min-w-0 truncate">
              {item.quantity} × {item.name}
            </span>
            <span className="tabular-nums text-tinta">{formatMoney(item.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="mb-3.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="font-bold text-tinta">Total</dt>
        <dd className="font-bold tabular-nums text-tinta">{formatMoney(row.total)}</dd>
        <dt className="text-tinta-suave">Pago</dt>
        <dd>{paymentLabel(row.paymentMethod, row.paymentStatus)}</dd>
      </dl>
      {row.paymentMethod === "efectivo" ? <Alert tone="warning" className="mb-3.5">El repartidor cobra {formatMoney(row.total)} en efectivo al entregar.</Alert> : null}
      {row.reason ? <Alert tone="warning" className="mb-3.5">Motivo: {row.reason}</Alert> : null}

      {courierApp ? (
        <>
          <IssuesPanel issues={row.issues ?? []} resolve={courierApp.resolveIssue} onReclassify={canReclassify ? () => setReclassifying(true) : undefined} />
          <OfferPanel orderId={row.id} canOffer={!assigned && ["confirmado", "preparando", "listo"].includes(row.status)} offers={row.offers ?? []} loadOfferable={courierApp.loadOfferable} offer={courierApp.offer} cancel={courierApp.cancelOffer} />
          {row.courierHasAccount && (row.status === "listo" || row.status === "en_camino") ? (
            <Alert className="mb-3.5">
              {couriers.find((item) => item.id === row.courierId)?.name ?? "El repartidor"} usa la aplicación: él registra la {row.status === "listo" ? "recogida" : "entrega"} con foto y código. Solo despacha o entrega por él si no puede hacerlo, y deja el motivo.
            </Alert>
          ) : null}
        </>
      ) : null}

      {canAssign ? (
        <div className="mb-3.5 flex flex-col gap-2.5">
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
          <Button variant="secondary" onClick={saveCourier} disabled={pending || !courier || courier === row.courierId} className="self-start">
            {assigned ? "Cambiar repartidor" : "Asignar repartidor"}
          </Button>
        </div>
      ) : null}

      {message ? <Alert tone={message.ok ? "info" : "error"} className="mb-3.5">{message.text}</Alert> : null}
      {canReclassify ? (
        <div className="mb-3.5">
          <Button variant="secondary" disabled={pending} onClick={() => setReclassifying(true)}>
            Reclasificar a programado
          </Button>
          <p className="mt-1 text-xs text-tinta-suave">Úsalo si el pedido no cabe en una moto. Se le quita el repartidor y pasa a vehículo.</p>
        </div>
      ) : null}
      {actions.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-2.5">
            {actions.map((action, index) => (
              <Button key={action.to} variant={index === 0 ? "primary" : "danger"} disabled={pending || (action.needsCourier === true && !assigned)} onClick={() => (action.reason ? setAsking(action) : run(action))}>
                {action.label}
              </Button>
            ))}
          </div>
          {actions.some((a) => a.needsCourier) && !assigned ? <p className="text-xs text-tinta-suave">Asigna un repartidor para poder despachar.</p> : null}
        </div>
      ) : (
        <p className="text-[12.5px] text-tinta-suave">Este pedido ya terminó.</p>
      )}

      {courierApp && row.courierId && row.courierHasAccount && (row.status === "listo" || row.status === "en_camino") ? <CodeResetPanel orderId={row.id} reset={courierApp.resetCode} /> : null}
      {courierApp ? <OrderTrace orderId={row.id} load={courierApp.loadTrace} /> : null}

      {skipping ? (
        <ReasonDialog
          open
          onClose={() => setSkipping(null)}
          title={`${skipping.label} sin la evidencia completa`}
          description="El repartidor aún no registró la foto o el código de este paso. Si continúas, queda anotado en el pedido y en la auditoría."
          confirmLabel={skipping.label}
          onConfirm={async (reason) => {
            const result = await setStatus(row.id, { to: skipping.to, reason });
            if (result.ok) onMoved(skipping.to);
            return result;
          }}
        />
      ) : null}
      {reclassifying ? (
        <ReasonDialog
          open
          onClose={() => setReclassifying(false)}
          title={`Reclasificar pedido ${row.number}`}
          description="Pasa a entrega programada con vehículo. El cliente conserva lo que pagó y se le muestra el nuevo plazo. Queda registrado quién lo hizo y por qué."
          confirmLabel="Reclasificar"
          onConfirm={async (reason) => {
            const result = await reclassify(row.id, reason);
            if (result.ok) router.refresh();
            return result;
          }}
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
          onConfirm={async (reason) => {
            const result = await setStatus(row.id, { to: asking.to, reason });
            if (result.ok) onMoved(asking.to);
            return result;
          }}
        />
      ) : null}
    </Card>
  );
}
