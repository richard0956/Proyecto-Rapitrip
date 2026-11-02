"use client";

import { Badge, Card, DataTable, EmptyState, cn, type Column } from "@rapitrip/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { IssueInfo } from "@/components/delivery-issues";
import type { OfferableCourier } from "@/components/offer-panel";
import type { ActionResult } from "@/lib/action-error";
import type { VehicleClass } from "@/lib/courier-fit";
import { classLabel, type DeliveryClass } from "@/lib/delivery-class";
import { formatMoney } from "@/lib/money";
import { openOffer, type OfferInfo } from "@/lib/offers";
import type { TraceResult } from "@/lib/order-trace-server";
import { useNow } from "@/lib/use-now";
import { coordTab, orderStatusLabel, orderStatusTone, type CoordTab, type OrderStatus } from "@/lib/orders";
import { dispatchTabs } from "./dispatch-tabs";

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

/** Lo que conecta la ficha del pedido con la aplicación del repartidor: propuestas, avisos, códigos e historial. */
export type CourierAppActions = {
  loadOfferable: (orderId: string) => Promise<{ ok: true; couriers: OfferableCourier[] } | { ok: false; error: string }>;
  offer: (orderId: string, courierId: string) => Promise<ActionResult>;
  cancelOffer: (offerId: string) => Promise<ActionResult>;
  resolveIssue: (issueId: string, note: string) => Promise<ActionResult>;
  resetCode: (orderId: string, kind: "recogida" | "entrega", reason: string) => Promise<ActionResult>;
  loadTrace: (orderId: string) => Promise<TraceResult>;
};

/** Estado de la propuesta: esperando respuesta, rechazada o vencida (lo que pide una acción de coordinación). */
export function OfferBadge({ row, now }: { row: DispatchOrder; now: number }) {
  const offers = row.offers ?? [];
  if (row.courierId !== null || offers.length === 0) return null;
  const open = openOffer(offers, now);
  if (open) return <Badge tone="warning">Propuesta a {open.courierName}</Badge>;
  const last = offers[0];
  if (last?.status === "rechazada") return <Badge tone="danger">Rechazada por {last.courierName}</Badge>;
  if (last?.status === "vencida" || (last?.status === "pendiente" && new Date(last.expiresAt).getTime() <= now)) return <Badge tone="danger">Sin respuesta de {last.courierName}</Badge>;
  return null;
}

/** Los pedidos se refrescan solos cada 30 segundos mientras la pestaña del navegador está visible. */
export function useAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [router]);
}

/** Lista de coordinación: pestañas por etapa y la tabla a todo el ancho; cada fila abre la ficha de despacho del pedido. */
export function DispatchWorkspace({ rows, couriers, initialTab = "listos" }: { rows: DispatchOrder[]; couriers: Courier[]; initialTab?: CoordTab }) {
  const router = useRouter();
  const [tab, setTab] = useState<CoordTab>(initialTab);
  const now = useNow();
  useAutoRefresh();

  const count = (key: CoordTab) => rows.filter((row) => coordTab(row.status) === key).length;
  const visible = rows.filter((row) => coordTab(row.status) === tab);
  const courierName = (id: string | null) => couriers.find((c) => c.id === id)?.name ?? null;
  // La pestaña queda en la dirección: al volver de una ficha se regresa a la misma.
  const choose = (key: CoordTab) => {
    setTab(key);
    router.replace(key === "listos" ? "/coordinacion" : `/coordinacion?vista=${key}`, { scroll: false });
  };

  const columns: Column<DispatchOrder>[] = [
    {
      header: "Pedido",
      cell: (row) => (
        <Link href={`/coordinacion/pedidos/${row.number}`} className="block rounded-campo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
          <span className="block whitespace-nowrap font-bold underline-offset-2 hover:underline">Pedido {row.number}</span>
          <span className="block whitespace-nowrap text-xs text-tinta-suave">{row.createdAt}</span>
        </Link>
      ),
    },
    {
      header: "Tienda y destino",
      cell: (row) => (
        <span className="block min-w-0 max-w-[22rem]">
          <span className="block truncate font-semibold">{row.store}</span>
          <span className="block truncate text-xs text-tinta-suave">{row.address ?? "Sin dirección"}</span>
        </span>
      ),
    },
    {
      header: "Repartidor",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <span className={cn("whitespace-nowrap text-[13px]", !courierName(row.courierId) && "text-tinta-suave")}>{courierName(row.courierId) ?? "Sin repartidor"}</span>
          <OfferBadge row={row} now={now} />
          {(row.issues ?? []).length > 0 ? <Badge tone="warning">Aviso del repartidor</Badge> : null}
        </span>
      ),
    },
    { header: "Clase", cell: (row) => <Badge tone={row.deliveryClass === "express" ? "positive" : "neutral"}>{classLabel(row.deliveryClass)}</Badge> },
    { header: "Total", cell: (row) => <span className="whitespace-nowrap font-bold tabular-nums">{formatMoney(row.total)}</span> },
    { header: "Estado", cell: (row) => <Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge> },
    { header: "", className: "w-px pr-4", cell: () => <ChevronRight aria-hidden="true" className="size-4 text-tinta-suave" /> },
  ];

  return (
    <Card className="p-5">
      <div role="tablist" aria-label="Estado de los pedidos" className="mb-4 flex flex-wrap gap-2">
        {dispatchTabs.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => choose(item.key)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-bold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
                active ? "bg-hoja text-sobre-acento shadow-pulsa" : "bg-papel text-tinta ring-1 ring-borde hover:bg-menta/60",
              )}
            >
              {item.label}
              <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] tabular-nums", active ? "bg-white/20" : "bg-crema text-tinta-suave")}>{count(item.key)}</span>
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <EmptyState title="Sin pedidos">{dispatchTabs.find((item) => item.key === tab)?.empty}</EmptyState>
      ) : (
        <DataTable caption="Pedidos" columns={columns} rows={visible} rowKey={(row) => row.id} emptyTitle="" onRowClick={(row) => router.push(`/coordinacion/pedidos/${row.number}`)} />
      )}
    </Card>
  );
}
