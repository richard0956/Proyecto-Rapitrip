import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Fila de acceso rápido de «Requiere tu atención». */
export function AttentionRow({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex min-h-12 items-center gap-2.5 rounded-boton border border-borde bg-white px-3.5 py-3 text-cuerpo font-medium text-tinta transition-colors duration-200 hover:border-menta-borde hover:bg-menta/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
    >
      <span aria-hidden="true" className="shrink-0 text-hoja">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-tinta-suave transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
