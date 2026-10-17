import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./cn";

/** Tabla densa del prototipo: contenedor redondeado, cabecera cálida y filas de ~40 px. */
export function Table({ caption, className, children }: { caption: string; className?: string; children: React.ReactNode }) {
  return (
    // La región con desplazamiento debe poder usarse con teclado aunque la tabla no tenga enlaces ni botones (WCAG 2.1.1).
    <div role="region" aria-label={caption} tabIndex={0} className={cn("overflow-x-auto rounded-panel border border-borde bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja", className)}>
      <table className="w-full min-w-[560px] border-collapse text-left text-cuerpo">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const THead = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => <thead className={cn("bg-calido", className)} {...props} />;

export const Th = ({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th scope="col" className={cn("px-4 py-[11px] text-micro font-bold uppercase text-tinta-suave", className)} {...props} />
);

export const Tr = ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("border-t border-borde first:border-t-0", className)} {...props} />;

export const Td = ({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-4 py-[11px] align-middle text-tinta", className)} {...props} />;
