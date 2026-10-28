import { existsSync } from "node:fs";
import { join } from "node:path";
import { getSessionInfo } from "@rapitrip/supabase";
import { Reveal } from "@rapitrip/ui";
import { BadgePercent, ChevronRight, MapPin, Plus, Store } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CartBanner } from "@/components/cart-banner";
import { CategoryTile } from "@/components/category-tile";
import { HomeHero } from "@/components/home-hero";
import { ProductCard } from "@/components/product-card";
import { ProductRail } from "@/components/product-rail";
import { SectionHeader } from "@/components/section-header";
import { StoreCard } from "@/components/store-card";
import { getCategories, searchProducts, searchStores } from "@/lib/catalog";
import { parseFilters } from "@/lib/catalog-filters";
import { serverSupabase } from "@/lib/supabase";

/** Foto opcional para el centro del héroe (PNG o WebP con fondo transparente, por ejemplo un repartidor). */
const heroPhoto = ["webp", "png"].map((ext) => `/hero/repartidor.${ext}`).find((file) => existsSync(join(process.cwd(), "public", file))) ?? null;

const productGrid = "stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5";

/**
 * Bandeja blanca de esquinas amplias donde vive cada bloque de la portada. Aparece con un fundido suave al entrar en pantalla
 * y sus tarjetas (las listas con `stagger`) entran escalonadas detrás.
 */
function Tray({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Reveal className={`rounded-[2rem] bg-superficie p-5 shadow-[0_30px_60px_-44px_rgb(6_54_42/0.4)] ring-1 ring-selva/[0.04] sm:p-10 ${className}`}>{children}</Reveal>;
}

/** Estado de «Ofertas y promociones» cuando ningún comercio tiene rebajas activas. */
function DealsEmpty() {
  return (
    <div className="mt-6 flex flex-col items-center gap-4 rounded-tarjeta bg-gradient-to-br from-calido via-superficie to-menta/60 px-6 py-10 text-center ring-1 ring-selva/[0.05] sm:flex-row sm:text-left">
      <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-superficie text-naranja shadow-[0_12px_24px_-14px_rgb(6_54_42/0.45)]">
        <BadgePercent className="size-7" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold text-tinta">Pronto verás aquí las ofertas</p>
        <p className="mt-1 text-[13.5px] text-tinta-suave">Cuando un comercio rebaje un producto, aparece primero en esta sección.</p>
      </div>
      <Link href="/catalogo" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-selva px-5 text-[13px] font-semibold text-sobre-acento hover:bg-tinta">
        Ver el catálogo <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}

/** ¿El cliente con sesión todavía no guarda ninguna dirección? Sin sesión (o si la lectura falla) no se le pide nada aquí. */
async function needsAddress() {
  try {
    const supabase = await serverSupabase();
    const session = await getSessionInfo(supabase);
    if (!session.signedIn) return false;
    const { count, error } = await supabase.from("my_addresses").select("id", { count: "exact", head: true });
    return !error && count === 0;
  } catch {
    return false;
  }
}

/** Invitación a guardar la primera dirección de entrega, arriba de la portada. */
function AddressNudge() {
  return (
    <section aria-labelledby="sin-direccion" className="flex flex-col gap-4 rounded-[1.75rem] bg-superficie p-4 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.06] sm:flex-row sm:items-center sm:p-5">
      <span aria-hidden="true" className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-menta to-bruma text-hoja">
        <MapPin className="size-6" />
        <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full bg-naranja ring-2 ring-superficie" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="sin-direccion" className="text-[16px] font-bold text-tinta">
          ¿A dónde llevamos tus pedidos?
        </h2>
        <p className="mt-0.5 text-[13px] text-tinta-suave">Guarda tu casa o tu trabajo: la elegimos por ti al pagar y calculamos el envío desde ahí.</p>
      </div>
      <Link href="/perfil/direcciones" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-selva px-5 text-[13px] font-semibold text-sobre-acento transition-colors hover:bg-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
        <Plus aria-hidden="true" className="size-4" />
        Agregar dirección
      </Link>
    </section>
  );
}

export default async function Home() {
  // Si una lectura falla, la portada sigue mostrándose sin ese bloque.
  const [askAddress, stores, categories, bestSellers, deals, recent, promos, picksForYou] = await Promise.all([
    needsAddress(),
    searchStores({ q: null, tipo: null, categoria: null, abiertas: true }, 1, 6).catch(() => []),
    getCategories(null).catch(() => []),
    searchProducts(parseFilters({ orden: "vendidos" }), null, 1).catch(() => []),
    searchProducts(parseFilters({ abiertas: "1", descuento: "1", orden: "descuento" }), null, 1).catch(() => []),
    searchProducts(parseFilters({ abiertas: "1", orden: "recientes" }), null, 1).catch(() => []),
    searchProducts(parseFilters({ abiertas: "1", descuento: "1", orden: "recientes" }), null, 1).catch(() => []),
    searchProducts(parseFilters({ abiertas: "1", orden: "precio_asc" }), null, 1).catch(() => []),
  ]);
  // Solo cuenta como «más vendido» lo que de verdad se vendió en los últimos 30 días.
  const topSold = bestSellers.filter((product) => product.sold_units > 0).slice(0, 10);
  const popular = [...categories].filter((category) => category.product_count > 0).sort((a, b) => b.product_count - a.product_count).slice(0, 8);
  const featured = deals[0] ?? null;
  // Productos con foto para la composición central del héroe (sin repetir la oferta destacada).
  const picks = [...deals.slice(1), ...topSold, ...recent].filter((product, index, all) => product.cover_path && all.findIndex((p) => p.id === product.id) === index);

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-6 sm:gap-8">
      {askAddress ? (
        <Reveal>
          <AddressNudge />
        </Reveal>
      ) : null}
      <HomeHero featured={featured} picks={picks} photo={heroPhoto} />

      {popular.length > 0 ? (
        <Tray>
          <section aria-labelledby="categorias">
            <SectionHeader id="categorias" title="Categorías populares" href="/catalogo" />
            <ul className="stagger mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
              {popular.map((category, index) => (
                <CategoryTile key={category.id} category={category} index={index} />
              ))}
            </ul>
          </section>
        </Tray>
      ) : null}

      {stores.length > 0 ? (
        <Tray>
          <section aria-labelledby="tiendas">
            <SectionHeader id="tiendas" title="Tiendas abiertas ahora" text="Comercios afiliados que reciben pedidos en este momento." href="/tiendas" />
            <ul className="stagger -mx-5 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 [&>li]:w-[80%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </ul>
          </section>
        </Tray>
      ) : null}

      {/* Ofertas y promociones: siempre visible; sin rebajas activas invita a volver en vez de desaparecer. */}
      <Tray>
        <section aria-labelledby="promociones">
          <SectionHeader id="promociones" title="Ofertas y promociones" text="Las rebajas más nuevas de los comercios. Desliza para ver más." href="/catalogo?descuento=1&orden=recientes" />
          {promos.length > 0 ? (
            <ProductRail label="Ofertas y promociones">
              {promos.slice(0, 12).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ProductRail>
          ) : (
            <DealsEmpty />
          )}
        </section>
      </Tray>

      {topSold.length > 0 ? (
        <Tray>
          <section aria-labelledby="vendidos">
            <SectionHeader id="vendidos" title="Los más vendidos" text="Lo que más se pidió en los últimos 30 días." href="/catalogo?orden=vendidos" />
            <ul className={productGrid}>
              {topSold.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 5} />
              ))}
            </ul>
          </section>
        </Tray>
      ) : null}


      <Reveal>
        <CartBanner products={[...topSold, ...recent, ...deals]} />
      </Reveal>

      {recent.length > 0 ? (
        <Tray>
          <section aria-labelledby="novedades">
            <SectionHeader id="novedades" title="Recién agregados" text="Lo último que sumaron los comercios afiliados. Desliza para ver más." href="/catalogo?orden=recientes" />
            <ProductRail label="Recién agregados">
              {recent.slice(0, 12).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ProductRail>
          </section>
        </Tray>
      ) : null}

      {deals.length > 0 ? (
        <Tray>
          <section aria-labelledby="ofertas">
            <SectionHeader id="ofertas" title="Con descuento" text="Los mayores descuentos en tiendas abiertas." href="/catalogo?descuento=1&orden=descuento" />
            <ul className={productGrid}>
              {deals.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ul>
          </section>
        </Tray>
      ) : null}

      {picksForYou.length > 0 ? (
        <Tray>
          <section aria-labelledby="para-ti">
            <SectionHeader id="para-ti" title="Para ti" text="Buenos precios en tiendas abiertas." href="/catalogo?abiertas=1&orden=precio_asc" />
            <ul className={productGrid}>
              {picksForYou.slice(0, 5).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ul>
          </section>
        </Tray>
      ) : null}

      {/* Para comercios: al final de la portada, fuera del encabezado. */}
      <Reveal>
      <section aria-labelledby="vende" className="relative isolate overflow-hidden rounded-[2rem] bg-panel px-6 py-10 text-white sm:px-12 sm:py-12">
        <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 size-80 rounded-full bg-esmeralda/20 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-32 left-1/3 -z-10 size-80 rounded-full bg-marino/60 blur-3xl dark:bg-marino/15" />
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-esmeralda ring-1 ring-white/15">
              <Store aria-hidden="true" className="size-3.5" /> Para comercios
            </p>
            <h2 id="vende" className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[36px]">
              ¿Tienes un negocio? Vende en Rapitrip
            </h2>
            <ol className="mt-5 grid max-w-[640px] grid-cols-1 gap-3 sm:grid-cols-3">
              {["Envía tu solicitud", "Revisamos tus datos", "Firmamos y activamos"].map((step, index) => (
                <li key={step} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 text-[13px] font-semibold ring-1 ring-white/10">
                  <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-esmeralda text-[12px] font-extrabold text-panel">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <Link
            href="/vende"
            className="group inline-flex min-h-12 items-center gap-3 self-center justify-self-start rounded-full bg-superficie py-1.5 pl-5 pr-1.5 text-[14px] font-semibold text-selva transition-colors hover:bg-menta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:justify-self-end"
          >
            Afiliar mi comercio
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-selva text-sobre-acento transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
              <ChevronRight className="size-4" />
            </span>
          </Link>
        </div>
      </section>
      </Reveal>
    </main>
  );
}
