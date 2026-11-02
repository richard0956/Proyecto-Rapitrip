import { cn } from "@rapitrip/ui";
import type { ReactNode } from "react";

/** Encabezado de cada bloque de la ficha: icono en burbuja, título, explicación corta y, a la derecha, un estado o acción. */
export function SectionHeader({ icon, title, subtitle, actions, tone = "menta" }: { icon: ReactNode; title: string; subtitle?: string; actions?: ReactNode; tone?: "menta" | "lavanda" | "durazno" }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", tone === "menta" ? "bg-menta text-hoja" : tone === "lavanda" ? "bg-lavanda text-marino" : "bg-durazno text-durazno-texto")}>
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-tinta">{title}</h2>
          {subtitle ? <p className="mt-0.5 max-w-[60ch] text-[12.5px] leading-snug text-tinta-suave">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
