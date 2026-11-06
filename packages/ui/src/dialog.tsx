"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";

export type DialogProps = { open: boolean; onClose: () => void; title: string; children: ReactNode; /** Más ancho (detalles con tablas o varias columnas). */ wide?: boolean };

/** Diálogo modal sobre `<dialog>` nativo: foco atrapado y Escape cierran sin código extra. Tiene siempre una «X» para cerrarlo con el ratón o el dedo. */
export function Dialog({ open, onClose, title, children, wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={cn("m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-tarjeta border border-borde bg-papel p-6 text-tinta backdrop:bg-[#060b14]/70 backdrop:backdrop-blur-sm", wide ? "max-w-2xl" : "max-w-md")}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-xl font-extrabold text-tinta">
          {title}
        </h2>
        {/* `close()` del `<dialog>` dispara el mismo evento que Escape, así que el padre se entera por `onClose`. */}
        <button
          type="button"
          aria-label="Cerrar ventana"
          onClick={() => ref.current?.close()}
          className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-tinta-suave transition-colors hover:bg-calido hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-3">{open ? children : null}</div>
    </dialog>
  );
}
