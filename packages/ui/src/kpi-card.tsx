import type { ReactNode } from "react";
import { cn } from "./cn";
import { Card } from "./card";

const bubbles = { menta: "bg-menta text-hoja", lavanda: "bg-lavanda text-tinta", durazno: "bg-durazno text-durazno-texto" } as const;

/** Tarjeta de indicador: icono en burbuja, etiqueta, cifra grande y nota. */
export function KpiCard({ icon, tone = "menta", label, value, hint }: { icon: ReactNode; tone?: keyof typeof bubbles; label: string; value: ReactNode; hint?: string }) {
  return (
    <Card outerClassName="h-full transition-[box-shadow,transform] duration-500 ease-fluido group-hover:-translate-y-0.5 group-hover:shadow-flota" className="flex flex-col gap-2 p-[18px]">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className={cn("flex rounded-full p-2.5", bubbles[tone])}>
          {icon}
        </span>
        <p className="text-[12.5px] font-semibold text-tinta-suave">{label}</p>
      </div>
      <p className="text-[26px] font-extrabold leading-tight tabular-nums text-tinta">{value}</p>
      {hint ? <p className="text-[11.5px] text-tinta-suave">{hint}</p> : null}
    </Card>
  );
}
