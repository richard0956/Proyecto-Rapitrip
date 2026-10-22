"use client";

import { Alert, Badge, Button, Card, CardHeader, EmptyState, pillStyles } from "@rapitrip/ui";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
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

  // Los pedidos nuevos llegan solos: se refresca cada 30 segundos mientras la pestaña está visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);

  const counts = useMemo(() => ({ confirmar: rows.filter((r) => orderGroup(r.status) === "confirmar").length, curso: rows.filter((r) => orderGroup(r.status) === "curso").length, terminados: rows.filter((r) => orderGroup(r.status) === "terminados").length }), [rows]);
  const visible = rows.filter((row) => orderGroup(row.status) === tab);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <div role="tablist" aria-label="Estado de los pedidos" className="mb-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={pillStyles(tab === item.key)}>
              {item.label}
              <span className="tabular-nums opacity-90">{counts[item.key]}</span>
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
                        {row.store} · {row.itemCount} {row.itemCount === 1 ? "producto" : "productos"} · {row.createdAt}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums text-tinta">{formatMoney(row.total)}</span>
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
        <OrderDetail key={selected.id} row={selected} setStatus={setStatus} loadDistance={loadDistance} onMoved={(to) => setTab(orderGroup(to))} />
      ) : (
        <Card>
          <CardHeader title="Detalle del pedido" />
          <EmptyState title="Ninguno elegido">Selecciona un pedido para ver sus productos y responderlo.</EmptyState>
        </Card>
      )}
    </div>
  );
}

/** `onMoved` lleva la lista a la pestaña del nuevo estado: así el pedido sigue a la vista y seleccionado tras responderlo. */
function OrderDetail({ row, setStatus, loadDistance, onMoved }: { row: OrderRow; setStatus: (id: string, input: { to: string; reason?: string }) => Promise<ActionResult>; loadDistance: (id: string) => Promise<DistanceResult>; onMoved: (to: OrderStatus) => void }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [asking, setAsking] = useState<ShopAction | null>(null);
  const [pending, start] = useTransition();
  const actions = shopActions(row.status);

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
    <Card outerClassName="xl:sticky xl:top-6" className="p-5">
      <CardHeader title={`Pedido ${row.number}`} subtitle={`${row.store} · ${row.createdAt}`} actions={<Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge>} />
      {row.deadline ? (
        <Alert tone="warning" className="mb-3.5" icon={<Clock className="size-[18px]" />}>
          {row.status === "por_confirmar" ? `Responde antes de ${row.deadline}; si no, se cancela y se devuelve el stock.` : `Vence el ${row.deadline} si no se paga.`}
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
    </Card>
  );
}
