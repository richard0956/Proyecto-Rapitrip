"use client";

import { cn } from "@rapitrip/ui";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Flecha de volver de las pantallas de acceso (ingresar, registro, recuperar). Vuelve a la página anterior; si la persona llegó
 * directo a esta (sin historial), la lleva al inicio de la tienda. `tone` sigue el fondo donde se coloca: verde (panel) o claro.
 */
export function AuthBackButton({ tone }: { tone: "dark" | "light" }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      aria-label="Volver a la página anterior"
      title="Volver"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ease-fluido focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-esmeralda",
        tone === "dark" ? "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20" : "bg-superficie text-tinta ring-1 ring-selva/[0.08] hover:bg-crema",
      )}
    >
      <ArrowLeft aria-hidden="true" className="size-5" />
    </button>
  );
}
