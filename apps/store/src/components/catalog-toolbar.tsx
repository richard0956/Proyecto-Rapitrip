import { ArrowDownUp, Clock, SlidersHorizontal, Store, UserRound, Wallet, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { activeFilterCount, filtersHref, KIND_OPTIONS, SORT_OPTIONS, type CatalogFilters } from "@/lib/catalog-filters";
import { AutoSubmitForm } from "./auto-submit-form";

const pill = "relative flex h-11 w-[230px] shrink-0 items-center lg:w-auto lg:min-w-0 gap-2 rounded-full bg-crema px-4 text-[13px] text-tinta ring-1 ring-selva/[0.06] transition-shadow focus-within:ring-2 focus-within:ring-hoja";
const select = "min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-1 font-semibold text-tinta focus:outline-none";
const toggle = "relative flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-crema px-4 text-[13px] font-semibold text-tinta ring-1 ring-selva/[0.06] transition-colors duration-300 hover:bg-menta has-[:checked]:bg-selva has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hoja";

/** Selector en forma de píldora: el ícono indica el filtro y su nombre queda para lectores de pantalla. */
function SelectPill({ icon, label, name, value, children, className = "" }: { icon: ReactNode; label: string; name: string; value: string; children: ReactNode; className?: string }) {
  return (
    <label className={`${pill} ${className}`}>
      <span aria-hidden="true" className="shrink-0 text-hoja">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value} className={select}>
        {children}
      </select>
    </label>
  );
}

/**
 * Barra horizontal de filtros del catálogo, debajo de los círculos de categorías: ordenar, tienda, tipo de vendedor, rango de
 * precio y «Abiertas ahora». La búsqueda por nombre vive en el encabezado y «Descuentos» en los apartados, así que aquí solo
 * viajan ocultas para no perderlas al cambiar otro filtro. Es un formulario GET (cada combinación tiene su propia dirección):
 * los selectores y la casilla se aplican al cambiar; el precio, con «Aplicar» o Enter. En PC va en una sola fila alineada; en
 * móvil se desliza de lado.
 */
export function CatalogToolbar({ base, filters, stores }: { base: string; filters: CatalogFilters; stores: { id: string; name: string }[] }) {
  const count = activeFilterCount(filters);
  const cleared = filtersHref(base, { ...filters, q: null, tienda: null, min: null, max: null, tipo: null, abiertas: false, descuento: false, pagina: 1 });
  return (
    <AutoSubmitForm
      method="get"
      action={base}
      role="search"
      aria-label="Filtros del catálogo"
      className="flex flex-col gap-2 rounded-[1.75rem] bg-superficie p-3 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.05]"
    >
      {filters.categoria ? <input type="hidden" name="categoria" value={filters.categoria} /> : null}
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.descuento ? <input type="hidden" name="descuento" value="1" /> : null}

      <div className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        <div className={`flex w-max items-center gap-2 lg:grid lg:w-full ${stores.length > 0 ? "lg:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,1fr))_auto_auto]" : "lg:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(0,1fr))_auto_auto]"}`}>
          <SelectPill icon={<ArrowDownUp className="size-4" />} label="Ordenar" name="orden" value={filters.orden}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectPill>

          {stores.length > 0 ? (
            <SelectPill icon={<Store className="size-4" />} label="Tienda" name="tienda" value={filters.tienda ?? ""}>
              <option value="">Todas las tiendas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectPill>
          ) : null}

          <SelectPill icon={<UserRound className="size-4" />} label="Vendedor" name="tipo" value={filters.tipo ?? ""}>
            {KIND_OPTIONS.map((o) => (
              <option key={o.label} value={o.value ?? ""}>
                {o.value ? o.label : "Todos los vendedores"}
              </option>
            ))}
          </SelectPill>

          <fieldset className={pill}>
            <legend className="sr-only">Precio en NIO</legend>
            <Wallet aria-hidden="true" className="size-4 shrink-0 text-hoja" />
            <input aria-label="Precio mínimo" name="min" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={filters.min ?? ""} placeholder="Mín." className="w-full min-w-0 bg-transparent font-semibold focus:outline-none" />
            <span aria-hidden="true" className="text-tinta-suave">
              –
            </span>
            <input aria-label="Precio máximo" name="max" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={filters.max ?? ""} placeholder="Máx." className="w-full min-w-0 bg-transparent font-semibold focus:outline-none" />
          </fieldset>

          <label className={toggle}>
            <input type="checkbox" name="abiertas" value="1" defaultChecked={filters.abiertas} className="sr-only" />
            <Clock aria-hidden="true" className="size-4" />
            Abiertas<span className="sr-only"> ahora</span>
          </label>

          <div className="flex shrink-0 items-center gap-1">
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-selva px-5 text-[13px] font-semibold text-sobre-acento shadow-pulsa transition-colors hover:bg-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Aplicar
            </button>
            {count > 0 ? (
              <Link href={cleared} aria-label="Limpiar filtros" title="Limpiar filtros" className="inline-flex size-11 items-center justify-center rounded-full text-hoja hover:bg-crema focus-visible:outline-2 focus-visible:outline-hoja">
                <X aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </AutoSubmitForm>
  );
}
