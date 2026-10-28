import { ArrowRight, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import type { StoreSummary } from "@/lib/catalog";
import { kindLabel } from "@/lib/catalog-filters";

/** Portadas pastel; cada tienda toma siempre la misma según su nombre. */
// En oscuro cada portada se tiñe con un color de la paleta Medianoche (esmeralda, azul o naranja) en vez del pastel apagado.
const covers = [
  "from-menta via-superficie to-bruma/60 dark:from-selva/25 dark:via-superficie dark:to-marino/20",
  "from-durazno via-superficie to-calido dark:from-naranja/20 dark:via-superficie dark:to-selva/10",
  "from-lavanda via-superficie to-menta/70 dark:from-marino/25 dark:via-superficie dark:to-selva/15",
  "from-calido via-superficie to-durazno/70 dark:from-naranja/15 dark:via-superficie dark:to-marino/20",
  "from-bruma via-superficie to-lavanda/70 dark:from-marino/20 dark:via-superficie dark:to-selva/20",
];

function coverFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return covers[hash % covers.length];
}

/**
 * Tarjeta de tienda estilo vitrina: portada de color con el estado, la inicial en un círculo que monta sobre la portada, nombre y
 * tipo centrados, dirección, categorías y al pie la cantidad de productos con la flecha para entrar.
 */
export function StoreCard({ store }: { store: StoreSummary }) {
  return (
    <li className="group relative flex h-full flex-col overflow-hidden rounded-tarjeta bg-superficie text-center shadow-[0_18px_40px_-30px_rgb(6_54_42/0.35)] ring-1 ring-selva/[0.05] transition-[transform,box-shadow] duration-500 ease-fluido hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(6_54_42/0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div aria-hidden="true" className={`relative h-20 bg-gradient-to-br ${coverFor(store.name)}`}>
        <span className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-superficie/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm ${store.open_now ? "text-exito" : "text-tinta-suave"}`}>
          <span className={`size-1.5 rounded-full ${store.open_now ? "bg-esmeralda" : "bg-tinta-suave/50"}`} />
          {store.open_now ? "Abierta" : "Cerrada"}
        </span>
      </div>
      <span aria-hidden="true" className="relative mx-auto -mt-8 flex size-16 items-center justify-center rounded-full bg-superficie text-[24px] font-extrabold text-hoja dark:bg-menta shadow-[0_12px_24px_-12px_rgb(6_54_42/0.45)] ring-4 ring-superficie transition-colors duration-500 group-hover:bg-selva group-hover:text-esmeralda dark:group-hover:text-sobre-acento">
        {store.name.trim().charAt(0).toUpperCase()}
      </span>

      <div className="flex flex-1 flex-col items-center gap-2 px-5 pb-5 pt-3">
        <h2 className="line-clamp-1 text-[16px] font-bold leading-tight tracking-tight text-tinta">
          <Link href={`/tiendas/${store.id}`} className="rounded after:absolute after:inset-0 after:rounded-tarjeta focus-visible:outline-2 focus-visible:outline-hoja">
            {store.name}
          </Link>
        </h2>
        <p className="-mt-1 text-[12px] text-tinta-suave">
          {store.commerce_kind ? kindLabel(store.commerce_kind) : "Comercio afiliado"}
          <span className="sr-only">{store.open_now ? ", abierta" : ", cerrada"}</span>
        </p>

        {store.address ? (
          <p className="flex max-w-full items-start justify-center gap-1.5 text-[12.5px] text-tinta-suave">
            <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-1">{store.address}</span>
          </p>
        ) : null}
        {!store.open_now && store.closed_reason ? (
          <p className="flex items-start justify-center gap-1.5 text-[12.5px] text-tinta-suave">
            <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {store.closed_reason}
          </p>
        ) : null}

        {store.categories && store.categories.length > 0 ? (
          <ul aria-label="Categorías de la tienda" className="flex flex-wrap justify-center gap-1.5">
            {store.categories.slice(0, 3).map((name) => (
              <li key={name} className="rounded-full bg-crema px-2.5 py-1 text-[11px] font-semibold text-tinta-suave">
                {name}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-auto flex w-full items-center justify-between border-t border-selva/[0.06] pt-3 text-[12.5px] font-semibold text-tinta">
          {store.product_count} {store.product_count === 1 ? "producto" : "productos"}
          <span aria-hidden="true" className="inline-flex items-center gap-1.5 rounded-full bg-crema py-1.5 pl-3 pr-2 text-[12px] transition-colors duration-500 group-hover:bg-selva group-hover:text-white">
            Ver tienda <ArrowRight className="size-3.5" />
          </span>
        </p>
      </div>
    </li>
  );
}
