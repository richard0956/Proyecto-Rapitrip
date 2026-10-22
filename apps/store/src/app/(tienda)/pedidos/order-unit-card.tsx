import { Badge, Card } from "@rapitrip/ui";
import Link from "next/link";
import { classLabel, etaText } from "@/lib/delivery-class";
import { formatMoney } from "@/lib/money";
import { isOrderStatus, orderStatusLabel, orderStatusTone } from "@/lib/orders";
import { isMultiOrder, openOrders, type ListedOrder, type OrderUnit } from "@/lib/purchases";

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua" });

function StatusBadge({ status }: { status: string }) {
  return isOrderStatus(status) ? <Badge tone={orderStatusTone[status]}>{orderStatusLabel[status]}</Badge> : null;
}

function ClassLine({ order }: { order: ListedOrder }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-[13px] text-tinta-suave">
      <Badge tone={order.delivery_class === "express" ? "positive" : "neutral"}>{classLabel(order)}</Badge>
      {etaText(order)}
    </span>
  );
}

/**
 * Una unidad del listado de pedidos. Una compra con varios pedidos se muestra como un grupo (un pedido por entrega, con su
 * clase, plazo y estado); un pedido suelto, o una compra de un solo pedido, como una tarjeta normal.
 */
export function OrderUnitCard({ unit }: { unit: OrderUnit }) {
  if (!isMultiOrder(unit)) {
    const order = unit.orders[0]!;
    return (
      <li className="relative">
        <Card className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-tinta">
              <Link href={`/pedidos/${order.id}`} className="rounded after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-hoja">
                Pedido {order.number} · {order.store_name}
              </Link>
            </h2>
            <p className="text-[13px] text-tinta-suave">
              {order.created_at ? fecha.format(new Date(order.created_at)) : ""} · {order.item_count} {order.item_count === 1 ? "producto" : "productos"}
            </p>
            <ClassLine order={order} />
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} />
            <span className="text-[15px] font-extrabold text-hoja">{formatMoney(order.total)}</span>
          </div>
        </Card>
      </li>
    );
  }

  const open = openOrders(unit);
  return (
    <li>
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-tinta">
              <Link href={`/compras/${unit.checkoutId}`} className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-hoja">
                Compra de {unit.orders.length} pedidos
              </Link>
            </h2>
            <p className="text-[13px] text-tinta-suave">
              {unit.createdAt ? fecha.format(new Date(unit.createdAt)) : ""} · {open === 0 ? "todos terminaron" : open === 1 ? "1 sigue abierto" : `${open} siguen abiertos`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {unit.paymentStatus === "pendiente" ? <Badge tone="warning">Falta pagar</Badge> : null}
            <span className="text-[15px] font-extrabold text-hoja">{formatMoney(unit.total)}</span>
          </div>
        </div>
        <ul className="flex flex-col divide-y divide-borde rounded-2xl border border-borde bg-white/60">
          {unit.orders.map((order) => (
            <li key={order.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/pedidos/${order.id}`} className="text-[14px] font-bold text-tinta hover:underline focus-visible:outline-2 focus-visible:outline-hoja">
                  Pedido {order.number} · {order.store_name}
                </Link>
                <ClassLine order={order} />
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={order.status} />
                <span className="text-[14px] font-bold text-tinta">{formatMoney(order.total)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </li>
  );
}
