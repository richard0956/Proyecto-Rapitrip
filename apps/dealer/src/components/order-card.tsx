import { Card } from "@rapitrip/ui";
import { ArrowUpRight, Banknote, MapPin } from "lucide-react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { stepFor } from "@/lib/order-steps";
import type { CourierOrder } from "@/lib/types";
import { ClassBadge, StatusBadge } from "./status-badge";

/** Una fila por pedido abierto: toda la tarjeta es un enlace grande y dice qué toca hacer. */
export function OrderCard({ order }: { order: CourierOrder }) {
  const step = stepFor(order.status);
  return (
    <Link href={`/pedidos/${order.order_id}`} className="group block rounded-concha transition-transform duration-500 ease-fluido active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
      <Card outerClassName="transition-shadow duration-500 ease-fluido group-hover:shadow-flota" className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-extrabold text-tinta">Pedido {order.number}</p>
            <StatusBadge status={order.status} />
            <ClassBadge value={order.delivery_class} />
          </div>
          <p className="truncate text-[13.5px] text-tinta">{order.store_name}</p>
          <p className="flex items-center gap-1.5 text-[12.5px] text-tinta-suave">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{order.store_address ?? "Sin dirección de la tienda"}</span>
          </p>
          {order.cash_total != null && order.status !== "entregado" ? (
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-durazno-texto">
              <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
              Cobras {formatMoney(order.cash_total)}
            </p>
          ) : null}
          <p className="text-[12.5px] font-bold text-hoja">{step.title}</p>
        </div>
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-hoja transition-transform duration-500 ease-fluido group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
          <ArrowUpRight className="size-5" />
        </span>
      </Card>
    </Link>
  );
}
