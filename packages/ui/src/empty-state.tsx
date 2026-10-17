import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-tarjeta border border-dashed border-borde-campo bg-papel px-6 py-10 text-center">
      <p className="font-titulo text-xl text-selva">{title}</p>
      {children ? <p className="mt-1 text-tinta-suave">{children}</p> : null}
    </div>
  );
}
