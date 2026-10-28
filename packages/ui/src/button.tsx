import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpRight } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

/** Píldora con la curva fluida del sistema; al pulsar se hunde levemente, como un botón físico. */
export const buttonStyles = cva(
  "group inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition-[background-color,box-shadow,transform] duration-500 ease-fluido active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary: "bg-hoja text-sobre-acento shadow-pulsa hover:bg-selva",
        secondary: "bg-papel text-hoja shadow-[inset_0_0_0_1.5px_var(--hoja)] hover:bg-menta",
        soft: "bg-calido text-tinta hover:bg-durazno",
        ghost: "bg-transparent text-hoja hover:bg-menta",
        danger: "bg-rosa text-rojo hover:brightness-95",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

const islandStyles = {
  primary: "bg-superficie/15",
  secondary: "bg-hoja/10",
  soft: "bg-tinta/10",
  ghost: "bg-hoja/10",
  danger: "bg-rojo/10",
} as const;

type Variant = keyof typeof islandStyles;

/** Círculo con flecha pegado al borde interno del botón: se desplaza en diagonal al pasar el cursor. */
export function ButtonIsland({ variant = "primary" }: { variant?: Variant | null }) {
  return (
    <span
      aria-hidden="true"
      className={cn("-mr-3 ml-1 flex size-8 items-center justify-center rounded-full transition-transform duration-500 ease-fluido group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105", islandStyles[variant ?? "primary"])}
    >
      <ArrowUpRight className="size-4" />
    </span>
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles> & { arrow?: boolean };

export function Button({ variant, className, type = "button", arrow, children, ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonStyles({ variant }), className)} {...props}>
      {children}
      {arrow ? <ButtonIsland variant={variant} /> : null}
    </button>
  );
}
