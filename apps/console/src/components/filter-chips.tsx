import { pillStyles } from "@rapitrip/ui";
import Link from "next/link";
import { queryString } from "@/lib/filters";

export type ChipOption = { key: string; label: string; count?: number };

/** Filtros en píldora que viven en la URL: se pueden recargar y compartir. `keep` conserva los demás filtros activos. */
export function FilterChips({ basePath, param, current, options, keep }: { basePath: string; param: string; current: string; options: ChipOption[]; keep?: Record<string, string | undefined> }) {
  return (
    <nav aria-label="Filtros" className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Link key={option.key} href={`${basePath}${queryString({ ...keep, [param]: option.key })}`} aria-current={option.key === current ? "page" : undefined} className={pillStyles(option.key === current)}>
          {option.count === undefined ? option.label : `${option.label} · ${option.count}`}
        </Link>
      ))}
    </nav>
  );
}
