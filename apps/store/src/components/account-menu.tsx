"use client";

import { Avatar } from "@rapitrip/ui";
import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Botón de la cuenta en el encabezado: al tocarlo abre una burbuja pequeña debajo con «Cerrar sesión». Se cierra con Escape, al
 * tocar fuera o al devolver el foco fuera de ella. Los ajustes viven en su propio botón (la rueda), así no se confunden.
 */
export function AccountMenu({ email, photo, signOut }: { email: string | null; photo: string | null; signOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onFocus = (event: FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="menu-cuenta"
        aria-label="Mi cuenta"
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
      >
        {photo ? (
          <span aria-hidden="true" className="flex size-10 overflow-hidden rounded-full ring-2 ring-menta">
            <img src={photo} alt="" className="size-full object-cover" />
          </span>
        ) : (
          <Avatar name={email} />
        )}
      </button>
      {open ? (
        <div id="menu-cuenta" className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-52 rounded-2xl bg-superficie p-1.5 shadow-[0_22px_44px_-18px_rgb(6_54_42/0.45)] ring-1 ring-selva/10">
          {email ? <p className="truncate px-3 pb-1.5 pt-2 text-[12px] text-tinta-suave">{email}</p> : null}
          <form action={signOut}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-[13.5px] font-semibold text-tinta hover:bg-crema focus-visible:outline-2 focus-visible:outline-hoja">
              <LogOut aria-hidden="true" className="size-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
