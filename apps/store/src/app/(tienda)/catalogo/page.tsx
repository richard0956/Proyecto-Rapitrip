import { EmptyState } from "@rapitrip/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { ActiveFilters, CatalogFilters } from "@/components/catalog-filters";
import { Pager } from "@/components/pager";
import { ProductCard } from "@/components/product-card";
import { SortSelect } from "@/components/sort-select";
import { getCategories, PAGE_SIZE, searchProducts, searchStores } from "@/lib/catalog";
import { activeFilterCount, filtersHref, parseFilters } from "@/lib/catalog-filters";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Todos los productos de las tiendas de Rapitrip en un solo lugar: filtra por categoría, tienda, precio y tipo de vendedor.",
  alternates: { canonical: "/catalogo" },
};

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const [products, categories, stores] = await Promise.all([
    searchProducts(filters, filters.tienda, filters.pagina),
    getCategories(filters.tienda),
    searchStores({ q: null, tipo: null, categoria: null, abiertas: false }, 1, 48),
  ]);
  const storeOptions = stores.map((s) => ({ id: s.id, name: s.name }));
  const total = products[0]?.total_count ?? 0;
  const base = "/catalogo";
  const href = (page: number) => filtersHref(base, filters, { pagina: page });

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <header>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta sm:text-[34px]">Catálogo</h1>
        <p className="mt-1 text-[14px] text-tinta-suave">Todos los productos de las tiendas de Rapitrip. Filtra, compara y arma tu pedido.</p>
      </header>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filtros">
          <CatalogFilters base={base} filters={filters} categories={categories} stores={storeOptions} />
        </aside>

        <section aria-label="Resultados" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-[14px] font-bold text-tinta">
              {total === 0 ? "Sin resultados" : `${total} ${total === 1 ? "producto" : "productos"}`}
            </p>
            <SortSelect value={filters.orden} />
          </div>
          <ActiveFilters base={base} filters={filters} categories={categories} stores={storeOptions} />

          {products.length === 0 ? (
            <EmptyState title={activeFilterCount(filters) > 0 ? "No encontramos productos con esos filtros" : "Todavía no hay productos"}>
              {activeFilterCount(filters) > 0 ? (
                <>
                  Prueba con otra búsqueda o quita algún filtro.{" "}
                  <Link href={base} className="font-bold text-hoja underline">
                    Ver todo el catálogo
                  </Link>
                </>
              ) : (
                "Estamos sumando comercios y productos. Vuelve pronto."
              )}
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 3} />
              ))}
            </ul>
          )}
          <Pager page={filters.pagina} hasNext={filters.pagina * PAGE_SIZE < total} href={href} />
        </section>
      </div>
    </main>
  );
}
