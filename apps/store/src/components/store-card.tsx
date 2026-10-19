import { Badge, Card } from "@rapitrip/ui";
import { Clock, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import type { StoreSummary } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";

export function StoreCard({ store }: { store: StoreSummary }) {
  return (
    <li className="relative">
      <Card outerClassName="h-full" className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold leading-tight tracking-tight text-tinta">
            <Link href={`/tiendas/${store.id}`} className="rounded after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-hoja">
              {store.name}
            </Link>
          </h2>
          <Badge tone={store.open_now ? "positive" : "neutral"}>{store.open_now ? "Abierta" : "Cerrada"}</Badge>
        </div>
        <ul className="flex flex-col gap-1.5 text-[13px] text-tinta-suave">
          {store.address ? (
            <li className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {store.address}
            </li>
          ) : null}
          <li className="flex items-center gap-2">
            <Truck aria-hidden="true" className="size-4 shrink-0" />
            {store.delivery_fee > 0 ? `Envío ${formatMoney(store.delivery_fee)}` : "Envío gratis"}
          </li>
          {!store.open_now && store.closed_reason ? (
            <li className="flex items-start gap-2">
              <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {store.closed_reason}
            </li>
          ) : null}
        </ul>
        <p className="mt-auto text-xs font-bold text-hoja">
          {store.product_count} {store.product_count === 1 ? "producto" : "productos"}
        </p>
      </Card>
    </li>
  );
}
