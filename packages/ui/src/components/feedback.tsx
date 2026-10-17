import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export type AlertTone = "info" | "error";

const tones: Record<AlertTone, string> = {
  info: "border-menta-borde bg-menta",
  error: "border-guayaba bg-calido",
};

export function Alert({
  tone = "info",
  title,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: AlertTone; title?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-campo border-l-4 px-4 py-3 text-sm text-tinta", tones[tone], className)}
      {...rest}
    >
      {title ? <p className="font-bold">{title}</p> : null}
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-tarjeta border border-dashed border-borde-campo px-6 py-12 text-center">
      <h3 className="font-titulo text-xl font-extrabold text-selva">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-tinta-suave">{description}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-pulse rounded-campo bg-borde", className)} {...rest} />;
}
