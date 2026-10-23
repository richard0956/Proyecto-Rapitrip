"use client";

import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, SelectField } from "@rapitrip/ui";
import { MapPin, Phone, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { formatMoney } from "@/lib/money";
import { orderStatusLabel, orderStatusTone, orderStatuses, paymentLabel, type OrderStatus } from "@/lib/orders";
import { OrderRoute } from "@/components/order-route";
import type { RouteResult } from "@/lib/order-route";

export type AdminOrder = {
  id: string;
  number: number;
  channel: "web" | "mostrador";
  store: string;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentStatus: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  courier: string | null;
  cashier: string | null;
  reason: string | null;
  createdAt: string;
  address: string | null;
  phone: string | null;
  notes: string | null;
  items: { name: string; quantity: number; total: number }[];
};

const closed: OrderStatus[] = ["entregado", "cancelado", "rechazado"];

export function OrdersBoard({ rows, initialNumber, cancel, loadRoute }: { rows: AdminOrder[]; initialNumber: number | null; cancel: (id: string, reason: string) => Promise<ActionResult>; loadRoute: (id: string) => Promise<RouteResult> }) {
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(rows.find((row) => row.number === initialNumber)?.id ?? null);

  const visible = useMemo(() => {
    const text = query.trim().replace(/^#/, "");
    return rows.filter((row) => (!status || row.status === status) && (!channel || row.channel === channel) && (!text || String(row.number).includes(text) || row.store.toLowerCase().includes(text.toLowerCase())));
  }, [rows, status, channel, query]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card>
        <div className="mb-3.5 grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Buscar" icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Número o tienda" />
          <SelectField label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {orderStatuses.map((item) => (
              <option key={item} value={item}>{orderStatusLabel[item]}</option>
            ))}
          </SelectField>
          <SelectField label="Canal" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Todos</option>
            <option value="web">Tienda web</option>
            <option value="mostrador">Mostrador</option>
          </SelectField>
        </div>
        {visible.length === 0 ? (
          <EmptyState title="Sin pedidos">{rows.length === 0 ? "Todavía no hay pedidos." : "Prueba con otros filtros."}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {visible.map((row) => {
              const active = row.id === selectedId;
              return (
                <li key={row.id}>
                  <button type="button" aria-pressed={active} onClick={() => setSelectedId(active ? null : row.id)} className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-campo px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja ${active ? "bg-menta/50" : "hover:bg-calido/60"}`}>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-tinta">
                        {row.channel === "mostrador" ? "Venta" : "Pedido"} {row.number}
                      </span>
                      <span className="block truncate text-xs text-tinta-suave">
                        {row.store} · {row.createdAt}
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
        <AdminDetail key={selected.id} row={selected} cancel={cancel} loadRoute={loadRoute} />
      ) : (
        <Card>
          <CardHeader title="Detalle" />
          <EmptyState title="Ninguno elegido">Selecciona un pedido para ver sus datos.</EmptyState>
        </Card>
      )}
    </div>
  );
}

function AdminDetail({ row, cancel, loadRoute }: { row: AdminOrder; cancel: (id: string, reason: string) => Promise<ActionResult>; loadRoute: (id: string) => Promise<RouteResult> }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const canCancel = row.channel === "web" && !closed.includes(row.status);

  return (
    <Card outerClassName="xl:sticky xl:top-6" className="p-5">
      <CardHeader title={`${row.channel === "mostrador" ? "Venta" : "Pedido"} ${row.number}`} subtitle={`${row.store} · ${row.createdAt}`} actions={<Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge>} />
      <dl className="mb-3.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-tinta-suave">Canal</dt>
        <dd>{row.channel === "mostrador" ? `Mostrador${row.cashier ? ` · ${row.cashier}` : ""}` : "Tienda web"}</dd>
        <dt className="text-tinta-suave">Pago</dt>
        <dd>{paymentLabel(row.paymentMethod, row.paymentStatus)}</dd>
        {row.channel === "web" ? (
          <>
            <dt className="text-tinta-suave">Repartidor</dt>
            <dd>{row.courier ?? "Sin asignar"}</dd>
          </>
        ) : null}
      </dl>
      {row.address ? (
        <div className="mb-3.5 rounded-panel bg-calido/50 p-3.5 text-sm">
          <p className="flex items-start gap-2 text-tinta">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {row.address}
          </p>
          <p className="mt-1 flex items-center gap-2 text-tinta">
            <Phone className="size-4 shrink-0" aria-hidden="true" />
            {row.phone}
          </p>
          {row.notes ? <p className="mt-1 text-xs text-tinta-suave">Nota: {row.notes}</p> : null}
        </div>
      ) : null}
      {row.channel === "web" && row.address ? <OrderRoute orderId={row.id} load={loadRoute} /> : null}
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
        <dt className="text-tinta-suave">Subtotal</dt>
        <dd className="tabular-nums">{formatMoney(row.subtotal)}</dd>
        <dt className="text-tinta-suave">Envío</dt>
        <dd className="tabular-nums">{formatMoney(row.deliveryFee)}</dd>
        <dt className="font-bold text-tinta">Total</dt>
        <dd className="font-bold tabular-nums text-tinta">{formatMoney(row.total)}</dd>
      </dl>
      {row.reason ? <Alert tone="warning" className="mb-3.5">Motivo: {row.reason}</Alert> : null}
      {canCancel ? (
        <Button variant="danger" onClick={() => setAsking(true)}>
          Cancelar pedido
        </Button>
      ) : null}
      {asking ? (
        <ReasonDialog
          open
          onClose={() => setAsking(false)}
          title={`Cancelar pedido ${row.number}`}
          description="Se devuelve el stock. Si ya estaba pagado con tarjeta, se encola el reembolso al cliente."
          confirmLabel="Cancelar pedido"
          danger
          onConfirm={async (reason) => {
            const result = await cancel(row.id, reason);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
    </Card>
  );
}
