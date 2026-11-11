import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { createElement, type ReactNode } from "react";
import type { Category } from "@/lib/catalog";
import { filtersHref, type CatalogFilters } from "@/lib/catalog-filters";
import { AutoRail } from "./auto-rail";
import { categoryIcon } from "./category-tile";

/** Fondo pastel, borde e ícono de cada círculo; se repiten en orden, con los mismos tonos de las tarjetas de categoría. */
const tones = [
  "bg-menta ring-esmeralda/60 text-hoja",
  "bg-durazno ring-naranja/50 text-durazno-texto",
  "bg-lavanda ring-marino/40 text-marino",
  "bg-calido ring-naranja/40 text-naranja",
  "bg-rosa ring-rojo/40 text-rojo",
];

function Circle({ href, current, tone, label, count, icon }: { href: string; current: boolean; tone: string; label: string; count?: number; icon: ReactNode }) {
  return (
    <li className="shrink-0 snap-start">
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className="group flex w-[88px] flex-col items-center gap-2 rounded-2xl pb-1 pt-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja sm:w-[96px]"
      >
        <span
          aria-hidden="true"
          className={`flex size-[68px] items-center justify-center rounded-full ring-2 ring-offset-[3px] ring-offset-crema transition-[transform,box-shadow] duration-500 ease-fluido group-hover:-translate-y-0.5 sm:size-[76px] ${tone} ${
            current ? "!ring-[3px] !ring-selva shadow-[0_14px_26px_-14px_rgb(6_54_42/0.6)]" : "shadow-[0_10px_22px_-16px_rgb(6_54_42/0.45)]"
          }`}
        >
          {icon}
        </span>
        <span className={`line-clamp-2 text-[12.5px] leading-tight ${current ? "font-bold text-selva" : "font-semibold text-tinta"}`}>{label}</span>
        {count !== undefined ? <span className="-mt-1.5 text-[11px] text-tinta-suave">{count}</span> : null}
      </Link>
    </li>
  );
}

/** Categorías centradas cuando caben, con navegación manual mediante flechas o gestos. */
export function CategoryCircles({ base, filters, categories }: { base: string; filters: CatalogFilters; categories: Category[] }) {
  if (categories.length === 0) return null;
  const iconClass = "size-7 sm:size-8";
  return (
    <nav aria-label="Categorías" className="w-full">
      <AutoRail count={categories.length + 1} gap="0.75rem">
        <Circle
          href={filtersHref(base, filters, { categoria: null, pagina: 1 })}
          current={!filters.categoria}
          tone="bg-superficie ring-selva/25 text-selva"
          label="Todas"
          icon={<LayoutGrid className={iconClass} strokeWidth={1.6} />}
        />
        {categories.map((category, index) => (
          <Circle
            key={category.id}
            href={filtersHref(base, filters, { categoria: category.id, pagina: 1 })}
            current={filters.categoria === category.id}
            tone={tones[index % tones.length] ?? tones[0]!}
            label={category.name}
            count={category.product_count}
            icon={createElement(categoryIcon(category.name), { className: iconClass, strokeWidth: 1.6 })}
          />
        ))}
      </AutoRail>
    </nav>
  );
}
