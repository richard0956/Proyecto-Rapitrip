import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-borde-campo bg-white px-6 py-10 text-center">
      <p className="text-base font-extrabold text-tinta">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-sm text-sm text-tinta-suave">{children}</p> : null}
    </div>
  );
}
