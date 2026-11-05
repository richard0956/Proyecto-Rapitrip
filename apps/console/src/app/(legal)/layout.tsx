import { Logo } from "@rapitrip/ui";
import Link from "next/link";
import type { ReactNode } from "react";

/** Textos legales de la consola: públicos (se leen antes de ingresar), con la marca arriba y sin la barra lateral. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-borde bg-papel">
        <div className="mx-auto flex w-full max-w-[780px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Logo subtitle="Consola de operación" />
          <Link href="/login" className="text-[13.5px] font-bold text-hoja underline-offset-4 hover:underline">
            Ir a la consola
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
