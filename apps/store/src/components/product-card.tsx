import { ArrowRight, Store } from "lucide-react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog";
import { kindLabel } from "@/lib/catalog-filters";
import { formatMoney } from "@/lib/money";
import { ProductImage } from "./product-image";
import { QuickAdd } from "./quick-add";

const chip = "inline-flex items-center gap-1 rounded-full bg-papel/90 px-2.5 py-1 text-[11px] font-bold leading-none text-tinta shadow-sm backdrop-blur";

/**
 * Tarjeta de producto del catálogo: foto grande en una «concha» redondeada con etiquetas encima (categoría, tipo de vendedor,
 * pocas unidades), tienda con su estado, nombre y, abajo, el precio y el botón redondo de agregar. Toda la tarjeta es un enlace
 * a la ficha; el botón de agregar queda por encima.
 */
export function ProductCard({ product, showStore = true, priority = false }: { product: CatalogProduct; showStore?: boolean; priority?: boolean }) {
  const single = product.variant_count <= 1;
  const low = product.quick_max !== null && product.quick_max <= 5;
  return (
    <li className="group relative flex flex-col rounded-concha bg-papel p-2 shadow-suave ring-1 ring-selva/[0.07] transition-[transform,box-shadow] duration-500 ease-fluido hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgb(10_61_46/0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative overflow-hidden rounded-[1.4rem] bg-menta/50">
        <ProductImage
          path={product.cover_path}
          alt={product.name}
          priority={priority}
          className="aspect-[4/3] w-full transition-transform duration-700 ease-fluido group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {product.category_name ? <span className={chip}>{product.category_name}</span> : <span />}
          {product.commerce_kind === "empresa" ? <span className={`${chip} text-exito`}>Empresa</span> : null}
        </div>
        {low ? <span className={`${chip} pointer-events-none absolute bottom-2.5 left-2.5 text-durazno-texto`}>Pocas unidades</span> : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2.5 pt-3">
        {showStore ? (
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-tinta-suave">
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${product.store_open ? "bg-exito" : "bg-tinta-suave/50"}`} />
            <span className="truncate">{product.store_name}</span>
            <span className="sr-only">{product.store_open ? ", abierta" : ", cerrada"}</span>
          </p>
        ) : null}
        <h3 className="text-[15px] font-bold leading-snug text-tinta">
          <Link href={`/productos/${product.id}`} className="rounded after:absolute after:inset-0 after:rounded-concha focus-visible:outline-2 focus-visible:outline-hoja">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-tinta-suave">
          {product.brand_name ? `${product.brand_name} · ` : ""}
          {single ? "Una presentación" : `${product.variant_count} presentaciones`}
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-tinta-suave">{single ? "Precio" : "Desde"}</p>
            <p className="text-lg font-extrabold leading-none tracking-tight text-tinta">{formatMoney(product.min_price)}</p>
          </div>
          {single && product.store_open ? (
            <QuickAdd product={product} />
          ) : (
            <span aria-hidden="true" className="pointer-events-none flex size-11 shrink-0 items-center justify-center rounded-full bg-menta text-exito transition-colors duration-500 group-hover:bg-hoja group-hover:text-white">
              {product.store_open ? <ArrowRight className="size-5" /> : <Store className="size-5" />}
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
