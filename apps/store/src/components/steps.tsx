import type { ReactNode } from "react";

/** Pasos con línea de ruta: un círculo numerado por paso unido al siguiente por una línea. */
export function Steps({ items }: { items: { title: string; text: ReactNode }[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.title} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 ? <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 bg-menta-borde" /> : null}
          <span aria-hidden="true" className="z-10 flex size-9 shrink-0 items-center justify-center rounded-full bg-menta text-sm font-extrabold text-hoja">
            {index + 1}
          </span>
          <div className="pt-1">
            <p className="text-[15px] font-bold text-tinta">{item.title}</p>
            <p className="mt-0.5 text-[13.5px] text-tinta-suave">{item.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
