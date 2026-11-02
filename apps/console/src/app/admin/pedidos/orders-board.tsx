"use client";

import { Badge, Button, Card, DataTable, EmptyState, Field, KpiCard, type Column } from "@rapitrip/ui";
import { BellRing, CheckCheck, ChevronRight, ClipboardList, Search, Store, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { orderStatusLabel, orderStatusTone, orderStatuses, paymentLabel, type OrderStatus } from "@/lib/orders";

export type AdminOrder = {
  id: string;
  number: number;
  channel: "web" | "mostrador";
  store: string;
  status: OrderStatus;
  paymentMethod: string | null;
  paymentStatus: string | null;
  total: number;
  /** Repartidor de un pedido web o cajero de una venta de mostrador. */
  person: string | null;
  createdAt: string;
};

const open: OrderStatus[] = ["pendiente_pago", "por_confirmar", "en_validacion", "confirmado", "preparando", "listo", "en_camino"];
const selectClass = "min-h-10 rounded-full border border-borde-campo bg-papel px-3.5 text-[13px] font-bold text-tinta";

export const orderTitle = (row: { channel: "web" | "mostrador"; number: number }) => `${row.channel === "mostrador" ? "Venta" : "Pedido"} ${row.number}`;

/** Pedidos a todo el ancho: cifras de lo que está en curso, filtros y la tabla; cada fila abre la ficha del pedido. */
export function OrdersBoard({ rows }: { rows: AdminOrder[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const text = query.trim().replace(/^#/, "").toLowerCase();
    return rows.filter((row) => (!status || (status === "abiertos" ? open.includes(row.status) : row.status === status)) && (!channel || row.channel === channel) && (!text || String(row.number).includes(text) || row.store.toLowerCase().includes(text)));
  }, [rows, status, channel, query]);
  const clear = () => {
    setStatus("");
    setChannel("");
    setQuery("");
  };
  const count = (statuses: OrderStatus[]) => rows.filter((row) => statuses.includes(row.status)).length;

  const columns: Column<AdminOrder>[] = [
    {
      header: "Pedido",
      cell: (row) => (
        <Link href={`/admin/pedidos/${row.number}`} className="flex items-center gap-2.5 rounded-campo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
          <span aria-hidden="true" className={row.channel === "mostrador" ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-lavanda text-marino" : "flex size-9 shrink-0 items-center justify-center rounded-full bg-menta text-hoja"}>
            {row.channel === "mostrador" ? <Store className="size-4" /> : <Truck className="size-4" />}
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap font-bold underline-offset-2 hover:underline">{orderTitle(row)}</span>
            <span className="block text-xs text-tinta-suave">{row.channel === "mostrador" ? "Mostrador" : "Tienda web"}</span>
          </span>
        </Link>
      ),
    },
    { header: "Tienda", cell: (row) => <span className="line-clamp-2 max-w-[14rem]">{row.store}</span> },
    { header: "Fecha", cell: (row) => <span className="whitespace-nowrap tabular-nums text-tinta-suave">{row.createdAt}</span> },
    { header: "Pago", cell: (row) => <span className="whitespace-nowrap text-[12.5px]">{paymentLabel(row.paymentMethod, row.paymentStatus)}</span> },
    { header: "Repartidor o cajero", cell: (row) => <span className="whitespace-nowrap text-[12.5px]">{row.person ?? <span className="text-tinta-suave">{row.channel === "web" ? "Sin asignar" : "—"}</span>}</span> },
    { header: "Total", cell: (row) => <span className="whitespace-nowrap font-bold tabular-nums">{formatMoney(row.total)}</span> },
    { header: "Estado", cell: (row) => <Badge tone={orderStatusTone[row.status]}>{orderStatusLabel[row.status]}</Badge> },
    { header: "", className: "w-px pr-4", cell: () => <ChevronRight aria-hidden="true" className="size-4 text-tinta-suave" /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard icon={<ClipboardList className="size-[18px]" />} label="En curso" value={count(open)} hint="Sin entregar ni cancelar" /></li>
        <li><KpiCard icon={<BellRing className="size-[18px]" />} tone="durazno" label="Por confirmar" value={count(["por_confirmar", "en_validacion"])} hint="Esperan respuesta del comercio" /></li>
        <li><KpiCard icon={<Truck className="size-[18px]" />} tone="lavanda" label="En camino" value={count(["en_camino"])} hint="Con un repartidor ahora" /></li>
        <li><KpiCard icon={<CheckCheck className="size-[18px]" />} label="Entregados" value={count(["entregado"])} hint={`De los últimos ${rows.length} pedidos`} /></li>
      </ul>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="w-full sm:w-72">
            <Field label="Buscar" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Número o tienda" />
          </div>
          <select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="">Todos los estados</option>
            <option value="abiertos">En curso</option>
            {orderStatuses.map((item) => (
              <option key={item} value={item}>
                {orderStatusLabel[item]}
              </option>
            ))}
          </select>
          <select aria-label="Canal" value={channel} onChange={(e) => setChannel(e.target.value)} className={selectClass}>
            <option value="">Todos los canales</option>
            <option value="web">Tienda web</option>
            <option value="mostrador">Mostrador</option>
          </select>
          <p role="status" className="text-[13px] text-tinta-suave sm:ml-auto">
            {visible.length} de {rows.length} pedidos
          </p>
        </div>
        {visible.length === 0 ? (
          <EmptyState title="Sin pedidos">
            {rows.length === 0 ? (
              "Todavía no hay pedidos."
            ) : (
              <Button variant="secondary" onClick={clear}>
                Limpiar filtros
              </Button>
            )}
          </EmptyState>
        ) : (
          <DataTable caption="Pedidos" columns={columns} rows={visible} rowKey={(row) => row.id} emptyTitle="" onRowClick={(row) => router.push(`/admin/pedidos/${row.number}`)} />
        )}
      </Card>
    </div>
  );
}
