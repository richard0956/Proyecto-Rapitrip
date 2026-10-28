"use client";

import { SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/** En pantallas anchas, el panel de filtros está siempre a la vista; en móvil se abre con un botón. */
export function FiltersPanel({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="lg:sticky lg:top-28">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-full bg-papel px-5 text-sm font-bold text-tinta shadow-suave ring-1 ring-selva/[0.07] focus-visible:outline-2 focus-visible:outline-hoja lg:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filtros
        </span>
        {activeCount > 0 ? <span className="rounded-full bg-hoja px-2 py-0.5 text-[11px] text-sobre-acento">{activeCount}</span> : null}
      </button>
      <div id={id} className={`${open ? "block" : "hidden"} mt-3 lg:mt-0 lg:block`}>
        {children}
      </div>
    </div>
  );
}
