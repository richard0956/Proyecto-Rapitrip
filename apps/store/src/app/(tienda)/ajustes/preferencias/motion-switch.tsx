"use client";

import { setMotionReduced, useMotionReduced } from "@rapitrip/ui";
import { Zap } from "lucide-react";

/** «Reducir animaciones»: se guarda en este navegador y se aplica al instante, con el mismo aspecto que el de los correos. */
export function MotionSwitch() {
  const reduced = useMotionReduced();
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
      <span className="flex items-start gap-3">
        <Zap aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-hoja" />
        <span>
          <span id="reducir-animaciones" className="block text-[14px] font-semibold text-tinta">
            Reducir animaciones
          </span>
          <span id="reducir-animaciones-texto" className="block text-[12.5px] text-tinta-suave">
            Sin introducción ni transiciones: las páginas y los productos aparecen al instante. Útil en teléfonos lentos o si el movimiento te molesta.
          </span>
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={reduced}
        aria-labelledby="reducir-animaciones"
        aria-describedby="reducir-animaciones-texto"
        onClick={() => setMotionReduced(!reduced)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 ease-fluido focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja ${reduced ? "bg-hoja" : "bg-borde-campo"}`}
      >
        <span aria-hidden="true" className={`absolute left-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-fluido ${reduced ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
