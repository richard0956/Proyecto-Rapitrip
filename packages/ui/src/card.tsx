import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-tarjeta border border-borde bg-papel p-5", className)} {...props} />;
}

/** Encabezado de tarjeta: título, subtítulo opcional y una acción a la derecha. */
export function CardHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-tinta">{title}</h2>
        {subtitle ? <p className="text-xs text-tinta-suave">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
