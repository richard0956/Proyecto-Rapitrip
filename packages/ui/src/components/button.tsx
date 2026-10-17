import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  // Mango: una sola acción principal por vista.
  primary: "bg-mango text-tinta hover:brightness-95",
  secondary: "border border-hoja bg-papel text-hoja hover:bg-menta",
  ghost: "bg-transparent text-hoja hover:bg-menta",
  // guayaba no cumple contraste como texto: va en borde y el texto queda en tinta.
  danger: "border-2 border-guayaba bg-papel text-tinta hover:bg-calido",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
