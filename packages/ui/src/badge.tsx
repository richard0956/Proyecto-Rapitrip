import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "./cn";

const badgeStyles = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold", {
  variants: {
    tone: {
      positive: "border-menta-borde bg-menta text-selva",
      neutral: "border-borde bg-calido text-tinta",
      alert: "border-guayaba bg-papel text-tinta",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>;

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}
