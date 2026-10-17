import type { HTMLAttributes } from "react";
import { cn } from "../cn";

export type BadgeTone = "positive" | "neutral" | "alert";

const tones: Record<BadgeTone, string> = {
  positive: "bg-menta text-selva",
  neutral: "bg-calido text-tinta",
  alert: "border border-guayaba bg-papel text-tinta",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold", tones[tone], className)}
      {...rest}
    />
  );
}
