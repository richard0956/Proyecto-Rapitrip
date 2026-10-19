import { Alert, Badge, EmptyState, pillStyles } from "@rapitrip/ui";
import { Clock, MapPin, Search, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pager } from "@/components/pager";
import { ProductCard } from "@/components/product-card";
import { getCategories, getProducts, getStore, isUuid, PAGE_SIZE } from "@/lib/catalog";
import { hoursRows } from "@/lib/hours";
import { formatMoney } from "@/lib/money";
import { buildQuery, parsePage, parseQuery } from "@/lib/search-params";
import { siteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; categoria?: string; pagina?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { id } = await params;
  const store = isUuid(id) ? await getStore(id) : null;
  if (!store) return { title: "Tienda no encontrada", robots: { index: false } };
  return {
    title: store.name,
    description: `Catálogo de ${store.name} en Rapitrip. ${store.delivery_fee > 0 ? `Envío ${formatMoney(store.delivery_fee)}.` : "Envío gratis."}`,
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

  const query = parseQuery(search.q);
  const categoryId = isUuid(search.categoria) ? search.categoria : null;
  const page = parsePage(search.pagina);
  const [categories, products] = await Promise.all([getCategories(id), getProducts(id, categoryId, query, page)]);
  const href = (p: number) => `/tiendas/${id}${buildQuery({ q: query, categoria: categoryId, pagina: p })}`;
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
          {store.delivery_fee > 0 ? `Envío ${formatMoney(store.delivery_fee)}` : "Envío gratis"}
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

      <form action={`/tiendas/${id}`} method="get" role="search" className="mt-6 flex max-w-md items-center gap-2">
        <label htmlFor="buscar" className="sr-only">
          Buscar en {store.name}
        </label>
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-full border border-borde-campo bg-white px-4 focus-within:border-hoja focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-hoja">
          <Search aria-hidden="true" className="size-4 shrink-0 text-tinta-suave" />
          <input id="buscar" name="q" type="search" maxLength={80} defaultValue={query ?? ""} placeholder="Buscar productos" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-tinta-suave" />
        </div>
        {categoryId ? <input type="hidden" name="categoria" value={categoryId} /> : null}
        <button type="submit" className="min-h-11 rounded-full bg-hoja px-5 text-sm font-bold text-white transition-colors hover:bg-selva focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
          Buscar
        </button>
      </form>

      {categories.length > 0 ? (
        <nav aria-label="Categorías" className="mt-4 flex flex-wrap gap-2">
          <Link href={`/tiendas/${id}${buildQuery({ q: query })}`} aria-current={!categoryId ? "page" : undefined} className={pillStyles(!categoryId)}>
            Todas
          </Link>
          {categories.map((category) => (
            <Link key={category.id} href={`/tiendas/${id}${buildQuery({ q: query, categoria: category.id })}`} aria-current={categoryId === category.id ? "page" : undefined} className={pillStyles(categoryId === category.id)}>
              {category.name} ({category.product_count})
            </Link>
          ))}
        </nav>
      ) : null}

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={query || categoryId ? "No encontramos productos con ese filtro" : "Esta tienda no tiene productos disponibles"}>
            {query || categoryId ? "Prueba con otra búsqueda o quita el filtro." : "Vuelve más tarde."}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ul>
      )}
      <Pager page={page} hasNext={products.length === PAGE_SIZE} href={href} />
    </main>
  );
}
