import { Armchair, Headphones, Laptop, LayoutGrid, Shirt, Store, Watch, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createElement, type ReactNode } from "react";
import type { CatalogProduct } from "@/lib/catalog";
import { ProductImage } from "./product-image";

/** Botón negro con ícono y dos líneas de texto, como las insignias de App Store y Google Play de la referencia. */
function BadgeLink({ href, icon, small, big }: { href: string; icon: LucideIcon; small: string; big: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center gap-2.5 rounded-xl bg-tinta py-2 pl-3 pr-5 text-white shadow-[0_14px_28px_-16px_rgb(20_35_29/0.8)] transition-[background-color,transform] duration-500 ease-fluido hover:-translate-y-0.5 hover:bg-selva focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
    >
      {createElement(icon, { "aria-hidden": true, className: "size-6 shrink-0" })}
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-medium text-white/70">{small}</span>
        <span className="mt-1 text-[15px] font-bold">{big}</span>
      </span>
    </Link>
  );
}

/** Productos variados (no de supermercado) para llenar la caja cuando todavía no hay fotos de productos. */
const goods: [LucideIcon, string][] = [
  [Laptop, "bg-lavanda text-marino"],
  [Armchair, "bg-durazno text-durazno-texto"],
  [Headphones, "bg-menta text-hoja"],
  [Wrench, "bg-calido text-naranja"],
  [Shirt, "bg-rosa text-rojo"],
  [Watch, "bg-crema text-tinta"],
];

/** Posiciones del montón dentro de la caja (de atrás hacia adelante). */
const pile = [
  "left-[4%] top-[30%] size-20 sm:size-24 -rotate-6",
  "left-[33%] top-[8%] size-24 sm:size-28 rotate-3",
  "right-[4%] top-[28%] size-20 sm:size-24 rotate-6",
  "left-[18%] top-[48%] size-20 sm:size-24 rotate-2",
  "right-[18%] top-[46%] size-20 sm:size-24 -rotate-3",
  "left-[40%] top-[54%] size-16 sm:size-20 rotate-6",
];

function Item({ className, children }: { className: string; children: ReactNode }) {
  return <div className={`absolute flex items-center justify-center overflow-hidden rounded-full shadow-[0_18px_30px_-16px_rgb(6_54_42/0.45)] ring-4 ring-white ${className}`}>{children}</div>;
}

/** Caja de envío abierta con un montón de productos variados asomando; usa fotos reales si hay al menos tres. */
function ShippingBox({ products }: { products: CatalogProduct[] }) {
  const photos = products.filter((product) => product.cover_path).slice(0, 6);
  const usePhotos = photos.length >= 3;
  return (
    <div aria-hidden="true" className="relative mx-auto h-[260px] w-full max-w-[400px] sm:h-[320px]">
      {/* Atrás las solapas abiertas, en medio el montón y adelante el frente de cartón: así los productos asoman por el borde. */}
      <div className="absolute bottom-[40%] left-[2%] h-[22%] w-[34%] origin-bottom-right -rotate-[24deg] rounded-md bg-[#c48a52]" />
      <div className="absolute bottom-[40%] right-[2%] h-[22%] w-[34%] origin-bottom-left rotate-[24deg] rounded-md bg-[#c48a52]" />
      <div className="absolute inset-x-[6%] top-[16%] h-[54%]">
        {usePhotos
          ? photos.map((product, index) => (
              <Item key={product.id} className={`bg-white ${pile[index]}`}>
                <ProductImage path={product.cover_path} alt="" fit="contain" className="size-full" />
              </Item>
            ))
          : goods.map(([icon, tone], index) => (
              <Item key={index} className={`${tone} ${pile[index]}`}>
                {createElement(icon, { className: "size-9 sm:size-10", strokeWidth: 1.6 })}
              </Item>
            ))}
      </div>
      <div className="absolute inset-x-[8%] bottom-[4%] h-[40%] rounded-b-2xl rounded-t-md bg-gradient-to-b from-[#e2ad73] to-[#d39a5e] shadow-[0_30px_50px_-24px_rgb(120_70_20/0.55)]">
        <div className="h-3 rounded-t-md bg-[#c48a52]" />
        <div className="absolute inset-y-0 left-1/2 w-[18%] -translate-x-1/2 bg-[#f1d3a8]/70" />
        <span className="absolute bottom-4 left-5 inline-flex items-center gap-1.5 rounded-md bg-white/85 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-selva">
          <img src="/brand/emblema-192.webp" width={163} height={192} alt="" className="h-3.5 w-auto" />
          Rapitrip
        </span>
      </div>
    </div>
  );
}

/** Banner celeste de la portada: titular grande, texto y dos insignias a la izquierda; la caja llena a la derecha. */
export function CartBanner({ products }: { products: CatalogProduct[] }) {
  return (
    <section aria-labelledby="llenar" className="relative isolate overflow-hidden rounded-[2rem] bg-white p-3 shadow-[0_30px_60px_-44px_rgb(6_54_42/0.4)] ring-1 ring-selva/[0.04] sm:p-4">
      <div className="grid grid-cols-1 items-center gap-6 rounded-[1.6rem] bg-gradient-to-b from-[#bfe3f5] via-[#e3f2f9] to-white px-6 pb-6 pt-10 md:grid-cols-[1.05fr_0.95fr] md:px-12 md:py-12">
        <div>
          <h2 id="llenar" className="max-w-[15ch] text-[32px] font-extrabold leading-[1.05] tracking-tight text-tinta sm:text-[44px]">
            ¿Listo para llenar tu carrito?
          </h2>
          <p className="mt-4 max-w-[42ch] text-[14.5px] leading-relaxed text-tinta-suave">Tecnología, muebles, herramientas, moda y mucho más de comercios afiliados, directo a tu puerta. Compra en varias tiendas a la vez.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <BadgeLink href="/catalogo" icon={LayoutGrid} small="Explora el" big="Catálogo" />
            <BadgeLink href="/tiendas" icon={Store} small="Descubre las" big="Tiendas" />
          </div>
        </div>
        <ShippingBox products={products} />
      </div>
    </section>
  );
}
