import { EmptyState, pillStyles } from "@rapitrip/ui";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/pager";
import { StoreCard } from "@/components/store-card";
import { getCategories, PAGE_SIZE, searchStores } from "@/lib/catalog";
import { activeFilterCount, filtersHref, KIND_OPTIONS, parseFilters } from "@/lib/catalog-filters";

export const metadata: Metadata = {
  title: "Tiendas",
  description: "Explora los comercios afiliados a Rapitrip, mira su catálogo y pide a tu puerta.",
  alternates: { canonical: "/tiendas" },
};

export default async function TiendasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [stores, categories] = await Promise.all([searchStores(filters, filters.pagina), getCategories(null)]);
  const base = "/tiendas";
  const href = (page: number) => filtersHref(base, filters, { pagina: page });
  const count = activeFilterCount(filters);

  return (
    <main className="mx-auto max-w-[1180px]">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta sm:text-[34px]">Tiendas</h1>
      <p className="mt-1 text-[14px] text-tinta-suave">Elige un comercio, arma tu carrito y recíbelo en tu puerta.</p>

      <form method="get" action={base} role="search" aria-label="Filtros de tiendas" className="mt-5 flex flex-col gap-3 rounded-concha bg-papel p-4 shadow-suave ring-1 ring-selva/[0.07] sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="relative">
            <label htmlFor="t-q" className="sr-only">
              Buscar tienda
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" />
            <input id="t-q" name="q" type="search" maxLength={80} defaultValue={filters.q ?? ""} placeholder="Buscar tienda…" className="min-h-11 w-full rounded-full border border-borde-campo bg-superficie pl-10 pr-4 text-sm focus-visible:outline-2 focus-visible:outline-hoja" />
          </div>
          <div>
            <label htmlFor="t-cat" className="sr-only">
              Categoría
            </label>
            <select id="t-cat" name="categoria" defaultValue={filters.categoria ?? ""} className="min-h-11 w-full rounded-full border border-borde-campo bg-superficie px-4 text-sm focus-visible:outline-2 focus-visible:outline-hoja">
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="t-tipo" className="sr-only">
              Tipo de vendedor
            </label>
            <select id="t-tipo" name="tipo" defaultValue={filters.tipo ?? ""} className="min-h-11 w-full rounded-full border border-borde-campo bg-superficie px-4 text-sm focus-visible:outline-2 focus-visible:outline-hoja">
              {KIND_OPTIONS.map((o) => (
                <option key={o.label} value={o.value ?? ""}>
                  {o.value ? o.label : "Todos los vendedores"}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-full bg-hoja px-6 text-sm font-bold text-sobre-acento shadow-pulsa transition-colors duration-500 hover:bg-selva focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
            Buscar
          </button>
        </div>
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 rounded-full px-3 text-sm font-bold text-tinta hover:bg-menta/60 focus-within:outline-2 focus-within:outline-hoja">
          <input type="checkbox" name="abiertas" value="1" defaultChecked={filters.abiertas} className="size-4 accent-[var(--hoja)]" />
          Solo tiendas abiertas ahora
        </label>
      </form>

      <nav aria-label="Atajos" className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={filtersHref(base, filters, { abiertas: false, pagina: 1 })} aria-current={!filters.abiertas ? "page" : undefined} className={pillStyles(!filters.abiertas)}>
          Todas
        </Link>
        <Link href={filtersHref(base, filters, { abiertas: true, pagina: 1 })} aria-current={filters.abiertas ? "page" : undefined} className={pillStyles(filters.abiertas)}>
          Abiertas ahora
        </Link>
        {count > 0 ? (
          <Link href={base} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-hoja underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-hoja">
            Limpiar filtros
          </Link>
        ) : null}
      </nav>

      {stores.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={count > 0 ? "No encontramos tiendas con esos filtros" : "Todavía no hay tiendas"}>
            {count > 0 ? "Prueba con otra búsqueda o quita algún filtro." : "Estamos sumando comercios. Vuelve pronto."}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </ul>
      )}
      <Pager page={filters.pagina} hasNext={stores.length === PAGE_SIZE} href={href} />
    </main>
  );
}
