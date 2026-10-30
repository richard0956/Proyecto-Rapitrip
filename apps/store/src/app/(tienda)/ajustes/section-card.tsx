import type { ReactNode } from "react";

/** Tarjeta de una parte de «Mi cuenta»: ícono, título, una línea de ayuda, una acción opcional a la derecha y el contenido. */
export function SectionCard({ icon, title, text, action, id, children }: { icon: ReactNode; title: string; text?: string; action?: ReactNode; id?: string; children: ReactNode }) {
  const titleId = id ? `${id}-titulo` : undefined;
  return (
    <section id={id} aria-labelledby={titleId} className="scroll-mt-28 rounded-[1.75rem] bg-superficie p-5 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.05] sm:p-7">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-menta/70 text-hoja">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-bold tracking-tight text-tinta">
              {title}
            </h2>
            {text ? <p className="mt-0.5 text-[13px] text-tinta-suave">{text}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
