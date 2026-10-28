import { Search, X } from "lucide-react";
import Link from "next/link";
import type { Category } from "@/lib/catalog";
import { activeFilterCount, filtersHref, KIND_OPTIONS, type CatalogFilters } from "@/lib/catalog-filters";
import { FiltersPanel } from "./filters-panel";

const label = "text-[11px] font-bold uppercase tracking-[0.14em] text-tinta-suave";
const input = "min-h-11 w-full rounded-full border border-borde-campo bg-superficie px-4 text-sm text-tinta placeholder:text-tinta-suave/70 focus-visible:outline-2 focus-visible:outline-hoja";

type Props = {
  /** Ruta que muestra el catálogo; el formulario y los enlaces vuelven a ella. */
  base: string;
  filters: CatalogFilters;
  categories: Category[];
  /** Tiendas para el selector; sin ellas (página de una tienda) el selector no se muestra. */
  stores?: { id: string; name: string }[];
};

/**
 * Barra de filtros del catálogo (columna lateral en pantallas anchas, botón desplegable en móvil): búsqueda, categorías con su
 * cantidad, tienda, rango de precio, tipo de vendedor y «solo abiertas». Es un formulario GET: no necesita JavaScript y cada
 * combinación tiene su propia dirección que se puede compartir. Las categorías son enlaces que conservan el resto de filtros.
 */
export function CatalogFilters({ base, filters, categories, stores }: Props) {
  const count = activeFilterCount(filters);
  return (
    <FiltersPanel activeCount={count}>
      <form method="get" action={base} role="search" aria-label="Filtros del catálogo" className="flex flex-col gap-6 rounded-concha bg-papel p-5 shadow-suave ring-1 ring-selva/[0.07]">
        {filters.categoria ? <input type="hidden" name="categoria" value={filters.categoria} /> : null}
        {filters.orden !== "nombre" ? <input type="hidden" name="orden" value={filters.orden} /> : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="f-q" className={label}>
            Buscar
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" />
            <input id="f-q" name="q" type="search" defaultValue={filters.q ?? ""} maxLength={80} placeholder="Producto…" className={`${input} pl-10`} />
          </div>
        </div>

        {categories.length > 0 ? (
          <nav aria-label="Categorías" className="flex flex-col gap-2">
            <p className={label}>Categorías</p>
            <ul className="flex flex-col gap-1">
              <li>
                <CategoryLink href={filtersHref(base, filters, { categoria: null, pagina: 1 })} current={!filters.categoria}>
                  Todas
                </CategoryLink>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <CategoryLink href={filtersHref(base, filters, { categoria: c.id, pagina: 1 })} current={filters.categoria === c.id} count={c.product_count}>
                    {c.name}
                  </CategoryLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {stores && stores.length > 0 ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="f-tienda" className={label}>
              Tienda
            </label>
            <select id="f-tienda" name="tienda" defaultValue={filters.tienda ?? ""} className={input}>
              <option value="">Todas las tiendas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className={`${label} mb-2`}>Precio (NIO)</legend>
          <div className="flex items-center gap-2">
            <input aria-label="Precio mínimo" name="min" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={filters.min ?? ""} placeholder="Mín." className={input} />
            <span aria-hidden="true" className="text-tinta-suave">
              –
            </span>
            <input aria-label="Precio máximo" name="max" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={filters.max ?? ""} placeholder="Máx." className={input} />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className={`${label} mb-2`}>Tipo de vendedor</legend>
          {KIND_OPTIONS.map((o) => (
            <label key={o.label} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-sm text-tinta hover:bg-menta/60 focus-within:outline-2 focus-within:outline-hoja">
              <input type="radio" name="tipo" value={o.value ?? ""} defaultChecked={(filters.tipo ?? null) === o.value} className="size-4 accent-[var(--hoja)]" />
              {o.label}
            </label>
          ))}
        </fieldset>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-sm font-bold text-tinta hover:bg-menta/60 focus-within:outline-2 focus-within:outline-hoja">
          <input type="checkbox" name="abiertas" value="1" defaultChecked={filters.abiertas} className="size-4 accent-[var(--hoja)]" />
          Solo tiendas abiertas ahora
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full px-3 text-sm font-bold text-tinta hover:bg-menta/60 focus-within:outline-2 focus-within:outline-hoja">
          <input type="checkbox" name="descuento" value="1" defaultChecked={filters.descuento} className="size-4 accent-[var(--hoja)]" />
          Solo productos con descuento
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-hoja px-6 text-sm font-bold text-sobre-acento shadow-pulsa transition-colors duration-500 hover:bg-selva focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
            Aplicar filtros
          </button>
          {count > 0 ? (
            <Link href={filtersHref(base, { ...filters, q: null, categoria: null, tienda: null, min: null, max: null, tipo: null, abiertas: false, descuento: false, pagina: 1 })} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-hoja underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-hoja">
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>
    </FiltersPanel>
  );
}

function CategoryLink({ href, current, count, children }: { href: string; current: boolean; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-full px-3 text-sm transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-hoja ${current ? "bg-hoja font-bold text-sobre-acento" : "text-tinta hover:bg-menta/60"}`}
    >
      <span className="truncate">{children}</span>
      {count !== undefined ? <span className={`text-xs ${current ? "text-white/80" : "text-tinta-suave"}`}>{count}</span> : null}
    </Link>
  );
}

/** Chips de los filtros activos, cada uno con su «quitar»; así se ve qué está filtrando la lista. */
export function ActiveFilters({ base, filters, categories, stores }: Pick<Props, "base" | "filters" | "categories" | "stores">) {
  const chips: { key: string; text: string; href: string }[] = [];
  const remove = (changes: Partial<CatalogFilters>) => filtersHref(base, filters, { ...changes, pagina: 1 });
  if (filters.q) chips.push({ key: "q", text: `«${filters.q}»`, href: remove({ q: null }) });
  const category = categories.find((c) => c.id === filters.categoria);
  if (filters.categoria) chips.push({ key: "c", text: category?.name ?? "Categoría", href: remove({ categoria: null }) });
  const store = stores?.find((s) => s.id === filters.tienda);
  if (filters.tienda) chips.push({ key: "t", text: store?.name ?? "Tienda", href: remove({ tienda: null }) });
  if (filters.min !== null || filters.max !== null) {
    const text = filters.min !== null && filters.max !== null ? `${filters.min} – ${filters.max} NIO` : filters.min !== null ? `Desde ${filters.min} NIO` : `Hasta ${filters.max} NIO`;
    chips.push({ key: "p", text, href: remove({ min: null, max: null }) });
  }
  if (filters.tipo) chips.push({ key: "k", text: filters.tipo === "empresa" ? "Empresas" : "Vendedores propios", href: remove({ tipo: null }) });
  if (filters.abiertas) chips.push({ key: "a", text: "Abiertas ahora", href: remove({ abiertas: false }) });
  if (filters.descuento) chips.push({ key: "d", text: "Con descuento", href: remove({ descuento: false }) });
  if (chips.length === 0) return null;
  return (
    <ul aria-label="Filtros activos" className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c.key}>
          <Link href={c.href} aria-label={`Quitar filtro ${c.text}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-menta px-3 text-[13px] font-bold text-exito hover:bg-menta/70 focus-visible:outline-2 focus-visible:outline-hoja">
            {c.text}
            <X aria-hidden="true" className="size-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
