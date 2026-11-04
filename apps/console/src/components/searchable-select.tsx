"use client";

import { cn } from "@rapitrip/ui";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { normalizeText } from "@/lib/directory";

export type SelectOption = { value: string; label: string; hint?: string };

/**
 * Desplegable con buscador para listas largas (tiendas, comercios): el botón muestra lo elegido y, al abrirlo, se escribe para
 * filtrar sin acentos. Con flechas se recorre, Enter elige y Escape cierra.
 */
export function SearchableSelect({ label, value, options, onChange, placeholder = "Elige una opción", allLabel, className }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; placeholder?: string; /** Si se da, agrega arriba la opción vacía («Todas las tiendas»). */ allLabel?: string; className?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const all = useMemo(() => (allLabel ? [{ value: "", label: allLabel }, ...options] : options), [allLabel, options]);
  const visible = useMemo(() => {
    const needle = normalizeText(query);
    return needle ? all.filter((option) => normalizeText(`${option.label} ${option.hint ?? ""}`).includes(needle)) : all;
  }, [all, query]);
  const selected = all.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(option: SelectOption) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[active];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        onClick={() => {
          setOpen((current) => !current);
          setActive(0);
        }}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-full border border-borde-campo bg-papel px-3.5 text-left text-[13px] font-bold text-tinta transition-colors hover:border-hoja focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
      >
        <span className={cn("truncate", !selected && "font-medium text-tinta-suave")}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-tinta-suave transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1.5 min-w-[16rem] overflow-hidden rounded-panel bg-papel shadow-flota ring-1 ring-borde">
          <div className="flex items-center gap-2 border-b border-borde px-3 py-2">
            <Search aria-hidden="true" className="size-4 shrink-0 text-tinta-suave" />
            <input
              ref={input}
              type="search"
              aria-activedescendant={visible[active] ? `${id}-op-${active}` : undefined}
              aria-label={`Buscar ${label.toLowerCase()}`}
              aria-controls={`${id}-lista`}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder="Escribe para buscar…"
              className="min-h-9 w-full bg-transparent text-[13px] text-tinta outline-none placeholder:text-tinta-suave"
            />
          </div>
          <ul id={`${id}-lista`} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1.5">
            {visible.length === 0 ? <li className="px-3 py-3 text-[13px] text-tinta-suave">Sin resultados.</li> : null}
            {visible.map((option, index) => {
              const isSelected = option.value === value;
              return (
                // El teclado se maneja desde el buscador (flechas y Enter); la opción responde al clic del ratón.
                <li
                  key={option.value || "__todas"}
                  id={`${id}-op-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActive(index)}
                  className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px]", index === active ? "bg-menta/70" : "hover:bg-crema", isSelected ? "font-bold text-hoja" : "text-tinta")}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{option.label}</span>
                    {option.hint ? <span className="block truncate text-[11.5px] font-medium text-tinta-suave">{option.hint}</span> : null}
                  </span>
                  {isSelected ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
