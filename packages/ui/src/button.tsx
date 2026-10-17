import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export const buttonStyles = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-boton px-[18px] text-sm font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary: "bg-hoja text-white hover:bg-selva",
        secondary: "border border-hoja bg-papel text-hoja hover:bg-menta",
        soft: "bg-calido text-tinta hover:bg-durazno",
        ghost: "bg-transparent text-hoja hover:bg-menta",
        danger: "bg-rosa text-rojo hover:brightness-95",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ variant, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant }), className)} {...props} />;
}
