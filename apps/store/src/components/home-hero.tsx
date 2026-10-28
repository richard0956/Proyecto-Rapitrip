import { Reveal } from "@rapitrip/ui";
import { ChevronRight, Sparkle, Truck } from "lucide-react";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { ProductImage } from "./product-image";

/** Tarjeta celeste de la esquina: la mejor oferta del momento, como la tarjeta de oferta de la referencia. */
function FeaturedDeal({ product }: { product: CatalogProduct }) {
  return (
    <Link
      href={`/productos/${product.id}`}
      className="group block w-[220px] rounded-3xl bg-gradient-to-b from-[#cfe9f7] via-[#e8f4fa] to-superficie dark:from-[#14304f] dark:via-[#0f1d33] p-3 shadow-flota ring-1 ring-superficie transition-transform duration-500 ease-fluido hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
    >
      <div className="relative">
        <ProductImage path={product.cover_path} alt={product.name} fit="contain" className="aspect-[4/3] w-full rounded-2xl !bg-transparent" />
        {product.discount_pct > 0 ? <span className="absolute left-1 top-1 rounded-full bg-selva px-2 py-1 text-[11px] font-extrabold leading-none text-sobre-acento">-{product.discount_pct}%</span> : null}
      </div>
      <p className="mt-2 truncate px-1 text-[14.5px] font-semibold text-tinta">{product.name}</p>
      <p className="flex items-baseline justify-between gap-2 px-1 pb-1">
        <span className="text-[17px] font-extrabold tracking-tight text-tinta">{formatMoney(product.min_price)}</span>
        {product.compare_price !== null ? (
          <span className="text-[12px] text-tinta-suave line-through">
            <span className="sr-only">Antes </span>
            {formatMoney(product.compare_price)}
          </span>
        ) : null}
      </p>
    </Link>
  );
}

/**
 * Pieza central del héroe, delante de la marca (como la persona de la referencia). Con una foto propia en `public/hero` la usa;
 * si no, arma la «bolsa» de Rapitrip: el emblema en una baldosa con productos reales flotando alrededor.
 */
function CenterPiece({ photo, picks }: { photo: string | null; picks: CatalogProduct[] }) {
  if (photo) {
    return <img src={photo} alt="" className="h-[300px] w-auto object-contain drop-shadow-[0_30px_40px_rgb(6_54_42/0.35)] lg:h-[400px]" />;
  }
  const spots = ["-left-16 top-6 -rotate-6", "-right-16 top-14 rotate-6", "-left-10 bottom-4 rotate-3"];
  return (
    <div className="relative">
      <div className="flex size-48 rotate-[-4deg] items-center justify-center rounded-[3rem] bg-superficie shadow-[inset_0_1px_1px_rgb(255_255_255/0.95),0_50px_80px_-30px_rgb(0_0_0/0.55)] lg:size-72">
        <img src="/brand/emblema-768.webp" width={651} height={768} alt="" className="h-32 w-auto lg:h-44" />
      </div>
      {picks.slice(0, 3).map((product, index) => (
        <div key={product.id} className={`absolute hidden size-20 overflow-hidden rounded-2xl bg-superficie p-1 shadow-flota ring-1 ring-selva/10 sm:block lg:size-24 ${spots[index]}`}>
          <ProductImage path={product.cover_path} alt="" fit="contain" className="size-full rounded-xl" />
        </div>
      ))}
      <span className="absolute -bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-selva px-3 py-1.5 text-[12px] font-semibold text-sobre-acento shadow-pulsa ring-2 ring-superficie">
        <Truck aria-hidden="true" className="size-3.5 text-esmeralda dark:text-sobre-acento" />
        Repartidor asignado
      </span>
    </div>
  );
}

/**
 * Héroe de la portada, a la manera de la referencia: panel verde que se aclara hacia abajo, «Rapitrip» enorme arriba con la
 * etiqueta inclinada, la pieza central delante de las letras, el llamado abajo a la izquierda y la oferta abajo a la derecha.
 */
export function HomeHero({ featured, picks, photo }: { featured: CatalogProduct | null; picks: CatalogProduct[]; photo: string | null }) {
  return (
    <section
      aria-labelledby="titulo"
      className="relative isolate flex flex-col items-center overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,var(--panel)_0%,#0d5644_55%,#14705a_100%)] lg:bg-[linear-gradient(180deg,var(--panel)_0%,#0d5644_38%,#5fae92_68%,#e9f5ef_92%)] dark:bg-[linear-gradient(180deg,#0b1a2e_0%,#0b2034_55%,#0d2a38_100%)] dark:lg:bg-[linear-gradient(180deg,#0b1a2e_0%,#0b2236_42%,#0e2c3a_70%,#0d1522_94%)] px-5 pb-6 pt-8 lg:block lg:h-[580px] lg:p-0"
    >
      <div aria-hidden="true" className="absolute -left-24 top-24 -z-10 size-96 rounded-full bg-esmeralda/15 blur-3xl" />

      {/* La marca enorme: decorativa, el título real es el h1. */}
      <div className="relative w-full lg:absolute lg:inset-x-0 lg:top-8">
        <p aria-hidden="true" className="select-none text-center font-titulo text-[clamp(68px,17.5vw,212px)] font-extrabold leading-[0.82] tracking-[-0.05em] text-esmeralda">
          Rapitrip
        </p>
        <span className="absolute right-[3%] top-[-10%] rotate-[-14deg] rounded-full bg-esmeralda px-3 py-1.5 text-[11px] font-bold text-panel shadow-pulsa ring-2 ring-selva/30 lg:right-[13%] lg:top-[2%] lg:px-4 lg:py-2 lg:text-[14px]">
          Entrega a domicilio
        </span>
        <Sparkle aria-hidden="true" className="absolute left-[4%] top-[88%] size-5 fill-esmeralda text-esmeralda lg:left-[8%] lg:size-7" />
        <Sparkle aria-hidden="true" className="absolute right-[4%] top-[88%] size-5 fill-esmeralda text-esmeralda lg:right-[8%] lg:size-7" />
      </div>

      {/* El centrado va en un contenedor aparte: la animación de Reveal usa `transform` y pisaría el -translate-x. */}
      <div className="relative z-10 mt-8 lg:absolute lg:inset-x-0 lg:bottom-28 lg:mt-0 lg:flex lg:justify-center">
        <Reveal index={1}>
          <CenterPiece photo={photo} picks={picks} />
        </Reveal>
      </div>

      <Reveal className="relative z-20 mt-10 w-full lg:absolute lg:bottom-10 lg:left-10 lg:mt-0 lg:w-auto lg:max-w-[330px]">
        <h1 id="titulo" className="text-[22px] font-bold leading-tight tracking-tight text-white lg:text-[26px] lg:text-tinta">
          Todo lo que buscas, de comercios de confianza
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/85 lg:text-tinta-suave">Tecnología, hogar, muebles, herramientas, moda y mucho más. Compra en varias tiendas y recíbelo en tu puerta.</p>
        <Link
          href="/catalogo"
          className="group mt-5 inline-flex min-h-12 items-center gap-3 rounded-full bg-selva py-1.5 pl-5 pr-1.5 text-[14px] font-semibold text-sobre-acento shadow-pulsa transition-colors duration-500 ease-fluido hover:bg-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          Comprar ahora
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-superficie text-selva transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
            <ChevronRight className="size-4" />
          </span>
        </Link>
      </Reveal>

      {featured ? (
        <Reveal index={2} className="relative z-20 mt-8 self-start lg:absolute lg:bottom-10 lg:right-10 lg:mt-0">
          <FeaturedDeal product={featured} />
        </Reveal>
      ) : null}
    </section>
  );
}
