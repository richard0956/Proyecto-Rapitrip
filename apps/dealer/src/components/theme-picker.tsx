"use client";

import { cn } from "@rapitrip/ui";
import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { createElement, useEffect, useSyncExternalStore } from "react";
import { applyTheme, CHOICE_EVENT, savedChoice, savedTheme, switchTheme, systemTheme, type ThemeChoice } from "@/lib/theme";

/** La elección cambia por este selector (aviso interno) o desde otra pestaña (evento `storage`). */
function subscribe(onChange: () => void) {
  window.addEventListener(CHOICE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHOICE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Mientras el repartidor no elija un tema fijo, la app sigue al sistema también si este cambia con la app abierta. No pinta nada. */
export function ThemeSync() {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!savedTheme()) applyTheme(systemTheme(), false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return null;
}

const options: { value: ThemeChoice; label: string; text: string; icon: LucideIcon }[] = [
  { value: "light", label: "Claro", text: "Fondo claro y el verde de la marca. Se lee mejor a pleno sol.", icon: Sun },
  { value: "dark", label: "Oscuro", text: "Medianoche: azul profundo y esmeralda. Cansa menos la vista de noche.", icon: Moon },
  { value: "system", label: "Sistema", text: "Cambia solo, igual que tu teléfono.", icon: Monitor },
];

/** Miniatura de cada tema: una barra, dos tarjetas y el botón. «Sistema» mezcla las dos mitades. */
function Preview({ value }: { value: ThemeChoice }) {
  const light = (
    <div className="flex h-full flex-col gap-1 bg-[#f4f8f5] p-1.5">
      <div className="h-3 rounded-md bg-[#06362a]" />
      <div className="flex flex-1 gap-1">
        <div className="flex-1 rounded bg-white" />
        <div className="flex-1 rounded bg-white" />
      </div>
      <div className="mx-auto h-1.5 w-2/3 rounded-full bg-[#0b7a57]" />
    </div>
  );
  const dark = (
    <div className="flex h-full flex-col gap-1 bg-[#060b14] p-1.5">
      <div className="h-3 rounded-md bg-[#0b1a2e]" />
      <div className="flex flex-1 gap-1">
        <div className="flex-1 rounded bg-[#0d1522]" />
        <div className="flex-1 rounded bg-[#0d1522]" />
      </div>
      <div className="mx-auto h-1.5 w-2/3 rounded-full bg-[#3ee0a4]" />
    </div>
  );
  return (
    <div aria-hidden="true" className="relative h-[72px] overflow-hidden rounded-xl ring-1 ring-borde">
      {value === "light" ? light : value === "dark" ? dark : (
        <>
          <div className="absolute inset-0">{light}</div>
          <div className="absolute inset-0 [clip-path:polygon(55%_0,100%_0,100%_100%,45%_100%)]">{dark}</div>
        </>
      )}
    </div>
  );
}

/**
 * Selector de tema de Preferencias: tres tarjetas lado a lado (caben en el teléfono) con su miniatura, y debajo qué hace la
 * elegida. Al tocar una, el nuevo tema se expande en un círculo desde esa tarjeta, como en la tienda.
 */
export function ThemePicker() {
  // En el servidor no se sabe la elección: ninguna tarjeta aparece marcada hasta hidratar.
  const choice = useSyncExternalStore<ThemeChoice | null>(subscribe, savedChoice, () => null);
  const selected = options.find((option) => option.value === choice);
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const checked = choice === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex cursor-pointer flex-col gap-2 rounded-2xl p-2 ring-1 transition-[background-color,box-shadow] duration-300 ease-fluido has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hoja",
                checked ? "bg-menta/60 ring-2 ring-hoja" : "bg-crema ring-borde hover:ring-borde-campo",
              )}
            >
              <input
                type="radio"
                name="tema"
                value={option.value}
                checked={checked}
                onChange={(event) => {
                  const box = (event.currentTarget.closest("label") ?? event.currentTarget).getBoundingClientRect();
                  switchTheme(option.value, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
                }}
                className="sr-only"
              />
              <Preview value={option.value} />
              <span className="flex items-center justify-center gap-1.5 pb-0.5 text-[13px] font-bold text-tinta">
                {createElement(option.icon, { "aria-hidden": true, className: cn("size-4", checked ? "text-hoja" : "text-tinta-suave") })}
                {option.label}
              </span>
              {checked ? (
                <span aria-hidden="true" className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-hoja text-sobre-acento shadow-pulsa">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <p className="min-h-[2lh] px-1 text-[12.5px] text-tinta-suave">{selected ? selected.text : " "}</p>
    </div>
  );
}
