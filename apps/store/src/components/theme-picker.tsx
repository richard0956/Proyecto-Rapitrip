"use client";

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

/**
 * Mientras el cliente no elija un tema fijo, la tienda sigue al sistema también si este cambia con la página abierta. Va en
 * el encabezado (que está en todas las páginas), sin pintar nada.
 */
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
  { value: "light", label: "Claro", text: "Fondo claro y verde de la marca.", icon: Sun },
  { value: "dark", label: "Oscuro", text: "Medianoche: azul profundo y esmeralda.", icon: Moon },
  { value: "system", label: "Según el sistema", text: "Cambia solo con tu dispositivo.", icon: Monitor },
];

/** Miniatura de cómo se ve cada tema: una barra y dos tarjetas. «Sistema» mezcla las dos mitades. */
function Preview({ value }: { value: ThemeChoice }) {
  const light = (
    <div className="flex h-full flex-col gap-1.5 bg-[#f4f8f5] p-2">
      <div className="h-2 rounded-full bg-white" />
      <div className="flex flex-1 gap-1.5">
        <div className="flex-1 rounded-md bg-white" />
        <div className="flex-1 rounded-md bg-white" />
      </div>
      <div className="h-2 w-1/2 rounded-full bg-[#06362a]" />
    </div>
  );
  const dark = (
    <div className="flex h-full flex-col gap-1.5 bg-[#060b14] p-2">
      <div className="h-2 rounded-full bg-[#0d1522]" />
      <div className="flex flex-1 gap-1.5">
        <div className="flex-1 rounded-md bg-[#0d1522]" />
        <div className="flex-1 rounded-md bg-[#0d1522]" />
      </div>
      <div className="h-2 w-1/2 rounded-full bg-[#3ee0a4]" />
    </div>
  );
  return (
    <div aria-hidden="true" className="relative h-24 overflow-hidden rounded-xl ring-1 ring-borde">
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
 * Selector de tema de Preferencias: tres tarjetas (claro, oscuro, según el sistema) con su miniatura. Al elegir, el nuevo
 * tema se expande en un círculo desde la tarjeta tocada.
 */
export function ThemePicker() {
  // En el servidor no se sabe la elección: ninguna tarjeta aparece marcada hasta hidratar.
  const choice = useSyncExternalStore<ThemeChoice | null>(subscribe, savedChoice, () => null);
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {options.map((option) => {
        const checked = choice === option.value;
        return (
          <label
            key={option.value}
            className={`group flex cursor-pointer flex-col gap-3 rounded-2xl p-3 ring-1 transition-[background-color,box-shadow] duration-300 ease-fluido has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hoja ${
              checked ? "bg-menta/50 ring-2 ring-hoja" : "bg-crema/50 ring-borde hover:ring-borde-campo"
            }`}
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
            <span className="flex items-start gap-2.5 px-1 pb-1">
              <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${checked ? "bg-hoja text-sobre-acento" : "bg-superficie text-hoja"}`}>
                {createElement(option.icon, { className: "size-4" })}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-tinta">{option.label}</span>
                <span className="block text-[12px] leading-snug text-tinta-suave">{option.text}</span>
              </span>
              <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full ${checked ? "bg-hoja text-sobre-acento" : "ring-1 ring-borde-campo"}`}>
                {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
