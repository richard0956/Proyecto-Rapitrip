import { ArrowRight, Store } from "lucide-react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog";
import { kindLabel } from "@/lib/catalog-filters";
import { formatMoney } from "@/lib/money";
import { DiscountBadge, PriceWas } from "./discount";
import { ProductImage } from "./product-image";
import { QuickAdd } from "./quick-add";

const chip = "inline-flex items-center gap-1 rounded-full bg-crema px-2.5 py-1 text-[11px] font-bold leading-none text-tinta-suave";

/**
 * Tarjeta de producto estilo vitrina: fondo blanco limpio, la foto entera al centro (sin recortar), nombre y tienda centrados,
 * el precio con la presentación y, abajo, la píldora «+ Agregar» (que pasa a contador cuando ya está en el carrito). Toda la
 * tarjeta es un enlace a la ficha; el botón de agregar queda por encima.
 */
export function ProductCard({ product, showStore = true, priority = false }: { product: CatalogProduct; showStore?: boolean; priority?: boolean }) {
  const single = product.variant_count <= 1;
  const low = product.quick_max !== null && product.quick_max <= 5;
  return (
    <li className="group relative flex flex-col rounded-tarjeta bg-superficie p-3 text-center shadow-[0_18px_40px_-30px_rgb(6_54_42/0.35)] ring-1 ring-selva/[0.05] transition-[transform,box-shadow] duration-500 ease-fluido hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgb(6_54_42/0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-4">
      <div className="relative">
        <ProductImage
          path={product.cover_path}
          alt={product.name}
          priority={priority}
          fit="contain"
          className="aspect-square w-full rounded-2xl transition-transform duration-700 ease-fluido group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2">
          <DiscountBadge pct={product.discount_pct} />
          {low ? <span className={`${chip} ml-auto bg-durazno text-durazno-texto`}>Pocas unidades</span> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1 pt-3">
        <h3 className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-tinta">
          <Link href={`/productos/${product.id}`} className="rounded after:absolute after:inset-0 after:rounded-tarjeta focus-visible:outline-2 focus-visible:outline-hoja">
            {product.name}
          </Link>
        </h3>
        {showStore ? (
          <p className="flex max-w-full items-center justify-center gap-1.5 text-[11.5px] text-tinta-suave">
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${product.store_open ? "bg-esmeralda" : "bg-tinta-suave/50"}`} />
            <span className="truncate">{product.store_name}</span>
            <span className="sr-only">{product.store_open ? ", abierta" : ", cerrada"}</span>
          </p>
        ) : product.brand_name ? (
          <p className="truncate text-[11.5px] text-tinta-suave">{product.brand_name}</p>
        ) : null}

        <p className="mt-2 flex max-w-full items-baseline justify-center gap-1">
          {!single ? <span className="shrink-0 text-[11px] font-semibold text-tinta-suave">Desde</span> : null}
          <span className="shrink-0 whitespace-nowrap text-[16px] font-extrabold leading-none tracking-tight text-tinta">{formatMoney(product.min_price)}</span>
          {single ? <span className="min-w-0 truncate text-[11px] text-tinta-suave">/ {product.quick_variant_name}</span> : null}
        </p>
        <PriceWas value={product.compare_price} className="text-[11.5px] font-semibold" />

        <div className="mt-auto flex w-full justify-center pt-3">
          {single && product.store_open ? (
            <QuickAdd product={product} />
          ) : (
            <span aria-hidden="true" className="pointer-events-none inline-flex min-h-10 items-center gap-1.5 rounded-full bg-crema px-4 text-[13px] font-bold text-tinta transition-colors duration-500 group-hover:bg-selva group-hover:text-white">
              {product.store_open ? (
                <>
                  Elegir <ArrowRight className="size-4" />
                </>
              ) : (
                <>
                  <Store className="size-4" /> Cerrada
                </>
              )}
            </span>
          )}
        </div>
        {!single || !product.store_open ? (
          <span className="sr-only">
            {kindLabel(product.commerce_kind)}. {product.store_open ? "Elige la presentación en la ficha del producto." : "La tienda está cerrada."}
          </span>
        ) : null}
      </div>
    </li>
  );
}
