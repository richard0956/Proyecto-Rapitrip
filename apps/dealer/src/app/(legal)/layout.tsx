import { BrandMark } from "@rapitrip/ui";
import Link from "next/link";
import type { ReactNode } from "react";

/** Textos legales del repartidor: públicos (se leen antes de ingresar), con la marca arriba y sin la barra de abajo. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-borde bg-superficie pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-[780px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <BrandMark className="text-[22px]" />
          <Link href="/" className="text-[13.5px] font-bold text-hoja underline-offset-4 hover:underline">
            Volver a la app
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
