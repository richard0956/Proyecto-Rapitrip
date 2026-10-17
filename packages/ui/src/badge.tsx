import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

const badgeStyles = cva("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-none", {
  variants: {
    tone: {
      positive: "bg-menta text-exito",
      warning: "bg-durazno text-durazno-texto",
      danger: "bg-rosa text-rojo",
      neutral: "bg-calido text-tinta-suave",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>;

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}

/** Etiqueta previa a un título: una píldora diminuta en mayúsculas con mucho espaciado. */
export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-full bg-menta px-3 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.2em] text-exito", className)} {...props} />;
}
