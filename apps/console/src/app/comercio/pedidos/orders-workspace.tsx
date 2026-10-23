"use client";

import { Alert, Badge, Button, Card, DataTable, Dialog, EmptyState, Field, pillStyles, type Column } from "@rapitrip/ui";
import { Clock, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { normalizeText } from "@/lib/directory";
import { classLabel, etaText, type DeliveryClass } from "@/lib/delivery-class";
import { formatMoney } from "@/lib/money";
import { orderGroup, orderStatusLabel, orderStatusTone, paymentLabel, shopActions, type OrderGroup, type OrderStatus, type ShopAction } from "@/lib/orders";
import { OrderDistance } from "@/components/order-route";
import type { DistanceResult } from "@/lib/order-route";

export type OrderItem = { name: string; quantity: number; unitPrice: number; total: number };
export type OrderRow = {
  id: string;
  number: number;
  store: string;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentStatus: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
  reason: string | null;
  deadline: string | null;
  deliveryClass: DeliveryClass;
  etaMinDays: number | null;
  etaMaxDays: number | null;
  reclassifiedReason: string | null;
  createdAt: string;
  items: OrderItem[];
};

const tabs: { key: OrderGroup; label: string; empty: string }[] = [
  { key: "confirmar", label: "Por confirmar", empty: "No hay pedidos esperando tu confirmación." },
  { key: "curso", label: "En curso", empty: "No hay pedidos en curso." },
  { key: "terminados", label: "Terminados", empty: "Todavía no hay pedidos terminados." },
];

export function OrdersWorkspace({ rows, setStatus, loadDistance }: { rows: OrderRow[]; setStatus: (id: string, input: { to: string; reason?: string }) => Promise<ActionResult>; loadDistance: (id: string) => Promise<DistanceResult> }) {
  const router = useRouter();
  const [tab, setTab] = useState<OrderGroup>("confirmar");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState("");

  // Los pedidos nuevos llegan solos: se refresca cada 30 segundos mientras la pestaña está visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const counts = useMemo(() => ({ confirmar: rows.filter((r) => orderGroup(r.status) === "confirmar").length, curso: rows.filter((r) => orderGroup(r.status) === "curso").length, terminados: rows.filter((r) => orderGroup(r.status) === "terminados").length }), [rows]);
  const stores = useMemo(() => [...new Set(rows.map((row) => row.store))].sort((a, b) => a.localeCompare(b)), [rows]);
  const needle = normalizeText(query);
  // Con una búsqueda escrita se mira en todos los estados: así se encuentra un pedido viejo sin saber en qué pestaña quedó.
  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (store !== "" && row.store !== store) return false;
        if (needle === "") return orderGroup(row.status) === tab;
        return String(row.number).includes(needle) || normalizeText(row.store).includes(needle) || row.items.some((item) => normalizeText(item.name).includes(needle));
      }),
    [rows, tab, store, needle],
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const columns: Column<OrderRow>[] = [
    {
      header: "Pedido",
      cell: (row) => (
        <button type="button" onClick={() => setSelectedId(row.id)} className="rounded-campo text-left font-bold text-hoja underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
          Pedido {row.number}
        </button>
      ),
    },
    { header: "Tienda", cell: (row) => row.store },
    { header: "Fecha", cell: (row) => row.createdAt },
    { header: "Productos", cell: (row) => <span className="tabular-nums">{row.itemCount}</span> },
    { header: "Total", cell: (row) => <span className="font-bold tabular-nums">{formatMoney(row.total)}</span> },
    { header: "Entrega", cell: (row) => classLabel(row.deliveryClass) },
    { header: "Estado", cell: (row) => <Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge> },
  ];

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:max-w-xs">
          <Field type="search" label="Buscar pedido" hideLabel icon={<Search className="size-4" />} placeholder="Número, tienda o producto…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div role="tablist" aria-label="Estado de los pedidos" className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button key={item.key} type="button" role="tab" aria-selected={needle === "" && tab === item.key} onClick={() => { setTab(item.key); setQuery(""); }} className={pillStyles(needle === "" && tab === item.key)}>
              {item.label}
              <span className="tabular-nums opacity-90">{counts[item.key]}</span>
            </button>
          ))}
        </div>
        {stores.length > 1 ? (
          <>
            <label className="sr-only" htmlFor="pedidos-tienda">
              Tienda
            </label>
            <select id="pedidos-tienda" value={store} onChange={(event) => setStore(event.target.value)} className="min-h-10 rounded-full border border-borde-campo bg-papel px-3.5 text-[13px] font-bold text-tinta">
              <option value="">Todas las tiendas</option>
              {stores.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>
      {needle !== "" ? <p className="mb-3 text-[13px] text-tinta-suave">Resultados de la búsqueda en todos los estados.</p> : null}
      {visible.length === 0 ? (
        needle !== "" ? (
          <EmptyState title="Ningún pedido coincide">
            <Button variant="secondary" onClick={() => setQuery("")}>
              Limpiar búsqueda
            </Button>
          </EmptyState>
        ) : (
          <EmptyState title="Sin pedidos">{tabs.find((item) => item.key === tab)?.empty}</EmptyState>
        )
      ) : (
        <DataTable caption="Pedidos" columns={columns} rows={visible} rowKey={(row) => row.id} emptyTitle="" />
      )}
      <Dialog open={selected !== null} onClose={() => setSelectedId(null)} title={selected ? `Pedido ${selected.number}` : "Pedido"} wide>
        {selected ? <OrderDetail key={selected.id} row={selected} setStatus={setStatus} loadDistance={loadDistance} onMoved={(to) => { setTab(orderGroup(to)); setQuery(""); }} /> : null}
      </Dialog>
    </Card>
  );
}

/** `onMoved` lleva la lista a la pestaña del nuevo estado: así el pedido sigue a la vista y seleccionado tras responderlo. */
function OrderDetail({ row, setStatus, loadDistance, onMoved }: { row: OrderRow; setStatus: (id: string, input: { to: string; reason?: string }) => Promise<ActionResult>; loadDistance: (id: string) => Promise<DistanceResult>; onMoved: (to: OrderStatus) => void }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [asking, setAsking] = useState<ShopAction | null>(null);
  const [pending, start] = useTransition();
  const actions = shopActions(row.status, row.deliveryClass);

  function run(action: ShopAction) {
    setMessage(null);
    start(async () => {
      const result = await setStatus(row.id, { to: action.to });
      setMessage(result.ok ? { ok: true, text: `Pedido ${row.number}: ${orderStatusLabel[action.to as OrderStatus].toLowerCase()}.` } : { ok: false, text: result.error });
      if (result.ok) {
        onMoved(action.to);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <p className="mb-3.5 flex items-center justify-between gap-3 text-sm text-tinta-suave">
        <span>
          {row.store} · {row.createdAt}
        </span>
        <Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge>
      </p>
      <p className="mb-3.5 flex flex-wrap items-center gap-2 text-sm text-tinta-suave">
        <Badge tone={row.deliveryClass === "express" ? "positive" : "neutral"}>{classLabel(row.deliveryClass)}</Badge>
        {etaText(row.deliveryClass, row.etaMinDays, row.etaMaxDays)}
      </p>
      {row.deliveryClass === "programado" ? (
        <Alert className="mb-3.5">
          Pedido programado: lo lleva un repartidor con vehículo y llega en días. Puedes pasarlo a «En validación» mientras confirmas disponibilidad o armado, y confirmarlo cuando esté validado.
        </Alert>
      ) : null}
      {row.reclassifiedReason ? <Alert tone="warning" className="mb-3.5">Coordinación lo pasó a programado: {row.reclassifiedReason}</Alert> : null}
      {row.deadline ? (
        <Alert tone="warning" className="mb-3.5" icon={<Clock className="size-[18px]" />}>
          {row.status === "por_confirmar"
            ? `Responde antes de ${row.deadline}; si no, se cancela y se devuelve el stock.`
            : row.status === "en_validacion"
              ? `Termina la validación antes de ${row.deadline}; si no, se cancela y se devuelve el stock.`
              : `Vence el ${row.deadline} si no se paga.`}
        </Alert>
      ) : null}
      <OrderDistance orderId={row.id} load={loadDistance} />
      <ul className="mb-3.5 flex flex-col divide-y divide-borde text-sm">
        {row.items.map((item) => (
          <li key={item.name} className="flex items-start justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block font-bold text-tinta">{item.name}</span>
              <span className="block text-xs text-tinta-suave">
                {item.quantity} × {formatMoney(item.unitPrice)}
              </span>
            </span>
            <span className="tabular-nums text-tinta">{formatMoney(item.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="mb-3.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-tinta-suave">Subtotal</dt>
        <dd className="tabular-nums">{formatMoney(row.subtotal)}</dd>
        <dt className="text-tinta-suave">Envío</dt>
        <dd className="tabular-nums">{formatMoney(row.deliveryFee)}</dd>
        <dt className="font-bold text-tinta">Total</dt>
        <dd className="font-bold tabular-nums text-tinta">{formatMoney(row.total)}</dd>
        <dt className="text-tinta-suave">Pago</dt>
        <dd>{paymentLabel(row.paymentMethod, row.paymentStatus)}</dd>
      </dl>
      {row.reason ? <Alert tone="warning" className="mb-3.5">Motivo: {row.reason}</Alert> : null}
      {message ? <Alert tone={message.ok ? "info" : "error"} className="mb-3.5">{message.text}</Alert> : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {actions.map((action, index) => (
            <Button key={action.to} variant={index === 0 ? "primary" : action.reason ? "danger" : "secondary"} disabled={pending} onClick={() => (action.reason ? setAsking(action) : run(action))}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-tinta-suave">
          {row.status === "listo" || row.status === "en_camino" ? "Coordinación se encarga de la entrega." : row.status === "pendiente_pago" ? "El pedido aparecerá para confirmar cuando el cliente pague." : "Este pedido ya terminó."}
        </p>
      )}
      {asking ? (
        <ReasonDialog
          open
          onClose={() => setAsking(null)}
          title={`${asking.label} pedido ${row.number}`}
          description="El cliente verá el motivo. Si ya había pagado con tarjeta, se le devuelve el dinero."
          confirmLabel={asking.label}
          danger
          onConfirm={async (reason) => {
            const result = await setStatus(row.id, { to: asking.to, reason });
            if (result.ok) onMoved(asking.to);
            return result;
          }}
        />
      ) : null}
    </div>
  );
}
