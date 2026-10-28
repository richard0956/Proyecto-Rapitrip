"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, currentTheme, savedTheme, type Theme } from "@/lib/theme";

/** El tema vive en `data-theme` de <html>: el botón lo lee de ahí y se entera de cualquier cambio. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/**
 * Botón luna/sol del encabezado. El tema ya viene puesto por el script del <head>; este botón solo lo cambia y recuerda la
 * elección. Mientras el cliente no elija, el tema sigue al sistema también si este cambia con la página abierta.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // En el servidor no se sabe el tema: el botón se pinta neutro y se completa al hidratar, sin desajuste.
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!savedTheme()) applyTheme(media.matches ? "dark" : "light", false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => applyTheme(currentTheme() === "dark" ? "light" : "dark", true)}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={theme === null ? undefined : dark}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className={`relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-superficie text-tinta ring-1 ring-selva/[0.08] transition-colors duration-500 ease-fluido hover:bg-crema focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja ${className}`}
    >
      <Sun aria-hidden="true" className={`absolute size-5 transition-[transform,opacity] duration-500 ease-fluido ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} />
      <Moon aria-hidden="true" className={`absolute size-5 transition-[transform,opacity] duration-500 ease-fluido ${dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
    </button>
  );
}
