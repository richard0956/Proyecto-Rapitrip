import { cn } from "@rapitrip/ui";
import { Check } from "lucide-react";
import type { StepKey } from "@/lib/order-steps";
import { stageIndex } from "@/lib/order-steps";

const stages = ["Preparación", "Recogida", "Entrega", "Hecho"] as const;

/** La línea de ruta de la marca: nodos unidos por una línea punteada que se va llenando a medida que avanza el pedido. */
export function RouteSteps({ step }: { step: StepKey }) {
  const current = stageIndex(step);
  if (current < 0) return null;
  return (
    <ol aria-label="Avance del pedido" className="flex items-start">
      {stages.map((label, index) => {
        const done = index < current || current === stages.length - 1;
        const active = index === current && !done;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="relative flex flex-1 flex-col items-center gap-1.5">
            {index > 0 ? <span aria-hidden="true" className={cn("absolute right-1/2 top-[13px] w-full border-t-2 border-dashed transition-colors duration-700 ease-fluido", index <= current ? "border-hoja" : "border-menta-borde")} /> : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative flex size-7 items-center justify-center rounded-full text-xs font-extrabold transition-[background-color,box-shadow] duration-700 ease-fluido",
                done ? "bg-hoja text-white ring-4 ring-papel" : active ? "bg-hoja text-white ring-4 ring-menta" : "bg-menta text-tinta-suave ring-4 ring-papel",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={2.5} /> : index + 1}
            </span>
            <span className={cn("text-[11px] font-bold", done || active ? "text-tinta" : "text-tinta-suave")}>
              {label}
              <span className="sr-only">{done ? " (hecho)" : active ? " (ahora)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
