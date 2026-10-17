import { cn } from "./cn";

/** Clases de las pestañas en píldora (filtros). Se aplican a un enlace o a un botón. */
export function pillStyles(active: boolean) {
  return cn(
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
    active ? "border-hoja bg-hoja text-white" : "border-borde-campo bg-papel text-tinta hover:bg-menta",
  );
}
