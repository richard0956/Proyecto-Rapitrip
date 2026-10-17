import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-tarjeta border border-borde bg-papel p-6", className)} {...rest} />;
}

export function StatCard({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <p className="text-sm font-bold text-tinta-suave">{label}</p>
      <p className="font-titulo text-4xl font-extrabold text-selva">{value}</p>
      {note ? <p className="text-sm text-tinta-suave">{note}</p> : null}
    </Card>
  );
}
