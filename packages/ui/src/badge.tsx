import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

const badgeStyles = cva("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-none", {
  variants: {
    tone: {
      positive: "bg-menta text-hoja",
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
