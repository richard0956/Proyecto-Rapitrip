import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type AlertProps = HTMLAttributes<HTMLDivElement> & { tone?: "error" | "info" };

export function Alert({ tone = "info", className, ...props }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-campo border px-3.5 py-2.5 text-sm font-medium",
        tone === "error" ? "border-guayaba bg-calido text-tinta" : "border-menta-borde bg-menta text-selva",
        className,
      )}
      {...props}
    />
  );
}
