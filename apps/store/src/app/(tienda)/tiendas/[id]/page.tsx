import { Alert, Badge, EmptyState } from "@rapitrip/ui";
import { Clock, MapPin, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActiveFilters, CatalogFilters } from "@/components/catalog-filters";
import { Pager } from "@/components/pager";
import { ProductCard } from "@/components/product-card";
import { SortSelect } from "@/components/sort-select";
import { getCategories, getStore, isUuid, PAGE_SIZE, searchProducts } from "@/lib/catalog";
import { activeFilterCount, filtersHref, kindLabel, parseFilters } from "@/lib/catalog-filters";
import { hoursRows } from "@/lib/hours";
import { siteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { id } = await params;
  const store = isUuid(id) ? await getStore(id) : null;
  if (!store) return { title: "Tienda no encontrada", robots: { index: false } };
  return {
    title: store.name,
    description: `Catálogo de ${store.name} en Rapitrip. Envío según la distancia.`,
    alternates: { canonical: `/tiendas/${store.id}` },
  };
}

const hhmm = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua" });

export default async function TiendaPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const search = await searchParams;
  const store = await getStore(id);
  if (!store) notFound();

  const filters = parseFilters({ ...search, tienda: id });
  const [categories, products] = await Promise.all([getCategories(id), searchProducts(filters, id, filters.pagina)]);
  const base = `/tiendas/${id}`;
  const total = products[0]?.total_count ?? 0;
  // En la página de una tienda la tienda ya está fijada: no es un filtro que se pueda quitar.
  const shown = { ...filters, tienda: null };
  const href = (p: number) => filtersHref(base, shown, { pagina: p });
  const rows = hoursRows(store.hours);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    url: `${siteUrl()}/tiendas/${store.id}`,
    ...(store.address ? { address: store.address } : {}),
  };

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Ruta de navegación" className="text-[13px] text-tinta-suave">
        <Link href="/tiendas" className="font-bold text-hoja hover:underline">
          Tiendas
        </Link>{" "}
        / {store.name}
      </nav>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta sm:text-[34px]">{store.name}</h1>
        <Badge tone={store.open_now ? "positive" : "neutral"}>{store.open_now ? "Abierta" : "Cerrada"}</Badge>
        {products[0] ? <Badge tone={products[0].commerce_kind === "empresa" ? "positive" : "neutral"}>{kindLabel(products[0].commerce_kind)}</Badge> : null}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px] text-tinta-suave">
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
      </ul>

      {!store.open_now ? (
        <Alert tone="warning" className="mt-5">
          Esta tienda está cerrada ahora: puedes ver su catálogo, pero no hacer pedidos.
          {store.closed_until ? ` Reabre el ${hhmm.format(new Date(store.closed_until))}.` : ""}
          {store.closed_reason ? ` Motivo: ${store.closed_reason}.` : ""}
        </Alert>
      ) : null}

      <details className="mt-4 max-w-md rounded-2xl bg-papel px-4 py-3 text-[13.5px] ring-1 ring-selva/[0.07]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold text-tinta focus-visible:outline-2 focus-visible:outline-hoja">
          <Clock aria-hidden="true" className="size-4" />
          Horario de atención
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {rows.map((row) => (
            <div key={row.day} className="contents">
              <dt className="font-bold text-tinta">{row.day}</dt>
              <dd className="text-tinta-suave">{row.text}</dd>
            </div>
          ))}
        </dl>
      </details>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filtros">
          <CatalogFilters base={base} filters={shown} categories={categories} />
        </aside>
        <section aria-label="Productos de la tienda" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-[14px] font-bold text-tinta">
              {total === 0 ? "Sin resultados" : `${total} ${total === 1 ? "producto" : "productos"}`}
            </p>
            <SortSelect value={filters.orden} />
          </div>
          <ActiveFilters base={base} filters={shown} categories={categories} />
          {products.length === 0 ? (
            <EmptyState title={activeFilterCount(shown) > 0 ? "No encontramos productos con esos filtros" : "Esta tienda no tiene productos disponibles"}>
              {activeFilterCount(shown) > 0 ? "Prueba con otra búsqueda o quita algún filtro." : "Vuelve más tarde."}
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} showStore={false} />
              ))}
            </ul>
          )}
          <Pager page={filters.pagina} hasNext={filters.pagina * PAGE_SIZE < total} href={href} />
        </section>
      </div>
    </main>
  );
}
