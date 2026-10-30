import { cn } from "@rapitrip/ui";
import { ArrowUpRight, Banknote, CheckCheck, Clock, MapPin, PackageOpen, Truck } from "lucide-react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { stepFor, type StepKey } from "@/lib/order-steps";
import type { CourierOrder } from "@/lib/types";
import { ClassBadge } from "./status-badge";

/** Ícono y color de la baldosa según lo que toca hacer: esperar, recoger, entregar o ya entregado. */
const stepLook: Record<StepKey, { Icon: typeof Clock; tile: string }> = {
  esperar: { Icon: Clock, tile: "bg-durazno text-durazno-texto" },
  recoger: { Icon: PackageOpen, tile: "bg-esmeralda text-panel" },
  entregar: { Icon: Truck, tile: "bg-selva text-sobre-acento" },
  entregado: { Icon: CheckCheck, tile: "bg-menta text-hoja" },
  cerrado: { Icon: CheckCheck, tile: "bg-borde text-tinta-suave" },
};

/**
 * Una fila por pedido, plana sobre la bandeja blanca del inicio (como los productos dentro de las bandejas de la tienda):
 * a la izquierda una baldosa con el paso actual (su ícono y el texto verde reemplazan la etiqueta de estado), en medio los datos y a la
 * derecha el círculo con la flecha. Toda la fila es el enlace.
 */
export function OrderCard({ order }: { order: CourierOrder }) {
  const step = stepFor(order.status);
  const { Icon, tile } = stepLook[step.key];
  return (
    <Link
      href={`/pedidos/${order.order_id}`}
      className="group flex items-center gap-3 rounded-[1.5rem] bg-crema p-3 ring-1 ring-selva/[0.05] transition-[background-color,transform] duration-500 ease-fluido hover:bg-menta/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
    >
      <span aria-hidden="true" className={cn("flex size-12 shrink-0 items-center justify-center self-start rounded-2xl", tile)}>
        <Icon className="size-[22px]" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[15px] font-extrabold text-tinta">Pedido {order.number}</p>
          <ClassBadge value={order.delivery_class} />
        </div>
        <p className="truncate text-[13.5px] font-semibold text-tinta">{order.store_name}</p>
        <p className="flex items-center gap-1.5 text-[12.5px] text-tinta-suave">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{order.store_address ?? "Sin dirección de la tienda"}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          <p className="text-[12.5px] font-bold text-hoja">{step.title}</p>
          {order.cash_total != null && order.status !== "entregado" ? (
            <p className="inline-flex items-center gap-1 rounded-full bg-durazno px-2 py-0.5 text-[11.5px] font-bold text-durazno-texto">
              <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
              Cobras {formatMoney(order.cash_total)}
            </p>
          ) : null}
        </div>
      </div>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-superficie text-selva shadow-[0_8px_18px_-12px_rgb(6_54_42/0.5)] transition-transform duration-500 ease-fluido group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
        <ArrowUpRight className="size-5" />
      </span>
    </Link>
  );
}
