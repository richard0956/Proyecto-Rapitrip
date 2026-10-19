"use client";

import { buttonStyles, ButtonIsland } from "@rapitrip/ui";
import Link from "next/link";

/** Fallo inesperado en una página de la tienda: se puede reintentar sin perder el carrito (vive en el navegador). */
export default function TiendaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <h1 className="text-[28px] font-extrabold tracking-tight text-tinta">Algo salió mal</h1>
      <p role="alert" className="mt-2 text-[13.5px] text-tinta-suave">
        No pudimos cargar esta página. Tu carrito sigue guardado. Inténtalo de nuevo en unos segundos.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonStyles({ variant: "primary", className: "pr-5" })}>
          Reintentar
          <ButtonIsland />
        </button>
        <Link href="/" className={buttonStyles({ variant: "secondary" })}>
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
