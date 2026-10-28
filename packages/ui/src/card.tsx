import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/**
 * Tarjeta de doble bisel: una bandeja exterior con borde de un pelo y, dentro, el cristal con su propio reflejo superior.
 * `className` va al núcleo (relleno, flex, gap); `outerClassName` a la bandeja (márgenes, ancho, sticky, altura).
 */
export function Card({ className, outerClassName, children, ...props }: HTMLAttributes<HTMLDivElement> & { outerClassName?: string }) {
  return (
    <div className={cn("flex rounded-concha bg-selva/[0.035] p-1.5 shadow-suave ring-1 ring-selva/[0.07]", outerClassName)}>
      <div className={cn("min-w-0 flex-1 rounded-[calc(1.75rem-0.375rem)] bg-papel p-5 shadow-[inset_0_1px_1px_rgb(255_255_255/0.95)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]", className)} {...props}>
        {children}
      </div>
    </div>
  );
}

/** Encabezado de tarjeta: título, subtítulo opcional y una acción a la derecha. */
export function CardHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-tinta">{title}</h2>
        {subtitle ? <p className="text-xs text-tinta-suave">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
