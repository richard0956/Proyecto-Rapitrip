import { cn } from "./cn";

/** Lema de la marca en texto vivo (con la tipografía del sistema): nítido a cualquier tamaño y legible para lectores de pantalla. */
export function Lema({ tone = "light", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-2.5 text-[10.5px] font-bold uppercase tracking-[0.22em]", tone === "dark" ? "text-bruma" : "text-hoja", className)}>
      <span aria-hidden="true" className={cn("h-px w-6", tone === "dark" ? "bg-esmeralda" : "bg-esmeralda")} />
      Seguridad y Confianza
    </p>
  );
}
