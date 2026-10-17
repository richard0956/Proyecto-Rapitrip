import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export const buttonStyles = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-mango text-tinta hover:brightness-95",
        secondary: "bg-hoja text-papel hover:bg-selva",
        ghost: "bg-transparent text-hoja hover:bg-menta",
        danger: "bg-guayaba text-tinta hover:brightness-95",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

/** Un solo botón `primary` (Mango) por vista. */
export function Button({ variant, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant }), className)} {...props} />;
}
