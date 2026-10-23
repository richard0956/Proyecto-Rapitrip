"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";

export type DialogProps = { open: boolean; onClose: () => void; title: string; children: ReactNode; /** Más ancho (detalles con tablas o varias columnas). */ wide?: boolean };

/** Diálogo modal sobre `<dialog>` nativo: foco atrapado y Escape cierran sin código extra. */
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
      className={cn("m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-tarjeta border border-borde bg-papel p-6 text-tinta backdrop:bg-selva/60", wide ? "max-w-2xl" : "max-w-md")}
    >
      <h2 id={titleId} className="text-xl font-extrabold text-tinta">
        {title}
      </h2>
      <div className="mt-3">{open ? children : null}</div>
    </dialog>
  );
}
