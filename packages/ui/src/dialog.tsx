"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type DialogProps = { open: boolean; onClose: () => void; title: string; children: ReactNode };

/** Diálogo modal sobre `<dialog>` nativo: foco atrapado y Escape cierran sin código extra. */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

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
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-tarjeta border border-borde bg-papel p-6 text-tinta backdrop:bg-selva/50"
    >
      <h2 id="dialog-title" className="font-titulo text-2xl text-selva">
        {title}
      </h2>
      <div className="mt-3">{open ? children : null}</div>
    </dialog>
  );
}
