import { Card, cn } from "@rapitrip/ui";
import type { ReactNode } from "react";

/** Tarjeta de una sección de «Mi cuenta»: icono en burbuja, título, explicación corta y su contenido. */
export function SectionCard({ icon, title, text, tone = "menta", actions, children, className }: { icon: ReactNode; title: string; text?: string; tone?: "menta" | "lavanda" | "durazno"; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", tone === "menta" ? "bg-menta text-hoja" : tone === "lavanda" ? "bg-lavanda text-marino" : "bg-durazno text-durazno-texto")}>
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-tinta">{title}</h2>
            {text ? <p className="mt-0.5 text-[12.5px] leading-snug text-tinta-suave">{text}</p> : null}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}
