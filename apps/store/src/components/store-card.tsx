import { Badge, Card } from "@rapitrip/ui";
import { Clock, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import type { StoreSummary } from "@/lib/catalog";
import { kindLabel } from "@/lib/catalog-filters";

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
        {store.commerce_kind ? <p className="-mt-1.5 text-[12px] font-bold text-tinta-suave">{kindLabel(store.commerce_kind)}</p> : null}
        <ul className="flex flex-col gap-1.5 text-[13px] text-tinta-suave">
          {store.address ? (
            <li className="flex items-start gap-2">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {store.address}
            </li>
          ) : null}
          <li className="flex items-center gap-2">
            <Truck aria-hidden="true" className="size-4 shrink-0" />
            Envío según la distancia
          </li>
          {!store.open_now && store.closed_reason ? (
            <li className="flex items-start gap-2">
              <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {store.closed_reason}
            </li>
          ) : null}
        </ul>
        {store.categories && store.categories.length > 0 ? (
          <ul aria-label="Categorías de la tienda" className="flex flex-wrap gap-1.5">
            {store.categories.map((name) => (
              <li key={name} className="rounded-full bg-menta px-2.5 py-1 text-[11px] font-bold text-exito">
                {name}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-auto text-xs font-bold text-hoja">
          {store.product_count} {store.product_count === 1 ? "producto" : "productos"}
        </p>
      </Card>
    </li>
  );
}
