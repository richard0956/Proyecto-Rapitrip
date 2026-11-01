"use client";

import { cn } from "@rapitrip/ui";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export type FaqTopic = "propuestas" | "pedidos" | "efectivo" | "cuenta";
export type FaqItem = { topic: FaqTopic; q: string; a: string };

const topics: { value: FaqTopic | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "propuestas", label: "Propuestas" },
  { value: "pedidos", label: "Recoger y entregar" },
  { value: "efectivo", label: "Efectivo" },
  { value: "cuenta", label: "App y cuenta" },
];

/** Preguntas frecuentes desplegables (como las de la tienda) con filtros por tema que se deslizan de lado. */
export function HelpFaq({ items }: { items: FaqItem[] }) {
  const [topic, setTopic] = useState<FaqTopic | "todas">("todas");
  const visible = topic === "todas" ? items : items.filter((item) => item.topic === topic);
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Tema de las preguntas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {topics.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={topic === item.value}
            onClick={() => setTopic(item.value)}
            className={cn(
              "min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-bold ring-1 transition-colors duration-300 ease-fluido focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
              topic === item.value ? "bg-selva text-sobre-acento ring-selva" : "bg-crema text-tinta ring-borde hover:bg-menta/60",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-2" aria-live="polite">
        {visible.map((item) => (
          <li key={item.q}>
            <details className="group rounded-2xl bg-crema ring-1 ring-selva/[0.05] transition-colors duration-300 ease-fluido open:bg-menta/50 open:ring-menta-borde">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[14px] font-bold text-tinta focus-visible:outline-2 focus-visible:outline-hoja [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta-suave transition-transform duration-300 ease-fluido group-open:rotate-180 group-open:text-hoja">
                  <ChevronDown className="size-4" />
                </span>
              </summary>
              <p className="px-4 pb-4 text-[13.5px] leading-relaxed text-tinta-suave">{item.a}</p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
