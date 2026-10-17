import { cn } from "@rapitrip/ui";

/** Marca de Rapitrip. `dark` es para fondos verdes (barra lateral y panel de acceso). */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-menta-borde text-lg font-extrabold text-selva">
        R
      </span>
      <div className="leading-[1.4]">
        <p className="text-[15px] font-extrabold text-white">RAPITRIP</p>
        <p className="text-[10.5px] text-menta-borde">Consola de operación</p>
      </div>
    </div>
  );
}
