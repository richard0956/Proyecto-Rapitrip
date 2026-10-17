import { cn } from "./cn";

/** Marca de Rapitrip. `dark` es para fondos verdes (barra lateral y panel de acceso); `light`, para fondos claros. */
export function Logo({ tone = "dark", subtitle, className }: { tone?: "dark" | "light"; subtitle?: string; className?: string }) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-full text-lg font-extrabold", dark ? "bg-menta-borde text-selva" : "bg-hoja text-white")}>
        R
      </span>
      <div className="leading-[1.4]">
        <p className={cn("text-[15px] font-extrabold", dark ? "text-white" : "text-selva")}>RAPITRIP</p>
        {subtitle ? <p className={cn("text-[10.5px]", dark ? "text-menta-borde" : "text-tinta-suave")}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
