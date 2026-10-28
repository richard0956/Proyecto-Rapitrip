"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SORT_OPTIONS, type CatalogSort } from "@/lib/catalog-filters";

/** «Ordenar por»: cambia el orden en la dirección y vuelve a la primera página. */
export function SortSelect({ value }: { value: CatalogSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function change(next: string) {
    const search = new URLSearchParams(params.toString());
    if (next === "nombre") search.delete("orden");
    else search.set("orden", next);
    search.delete("pagina");
    const text = search.toString();
    router.push(text ? `${pathname}?${text}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-[13px] font-bold text-tinta-suave">
      Ordenar por
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        className="min-h-11 rounded-full border border-borde-campo bg-superficie px-4 text-[13px] font-bold text-tinta focus-visible:outline-2 focus-visible:outline-hoja"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
