"use client";

import { Card, Field, cn } from "@rapitrip/ui";
import { ArrowUpRight, ChevronDown, Lightbulb, MessageCircleQuestion, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { normalizeText } from "@/lib/directory";
import type { HelpGuide } from "@/lib/help";

/** Manual del rol: buscador, temas agrupados que se abren uno a uno (con pasos, consejo y enlace) y preguntas frecuentes. */
export function HelpManual({ guide }: { guide: HelpGuide }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const needle = normalizeText(query);
    if (!needle) return guide.groups;
    return guide.groups
      .map((group) => ({ ...group, topics: group.topics.filter((topic) => normalizeText([topic.title, topic.summary, ...topic.steps, topic.tip ?? ""].join(" ")).includes(needle)) }))
      .filter((group) => group.topics.length > 0);
  }, [guide, query]);
  const total = groups.reduce((sum, group) => sum + group.topics.length, 0);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-micro font-bold uppercase text-hoja">Manual de {guide.role}</p>
              <p className="text-[13.5px] text-tinta">{guide.intro}</p>
            </div>
            <div className="w-full sm:w-72">
              <Field label="Buscar en el manual" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar: caja, repartidor, contraseña…" />
            </div>
          </div>
          {query ? <p role="status" className="mt-2 text-[12.5px] text-tinta-suave">{total === 0 ? "Ningún tema coincide." : `${total} ${total === 1 ? "tema" : "temas"}`}</p> : null}
        </Card>

        {groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-2.5">
            <h2 className="px-1 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">{group.title}</h2>
            {group.topics.map((topic) => (
              <details key={topic.id} id={topic.id} open={Boolean(query)} className="group rounded-panel bg-papel ring-1 ring-borde transition-shadow open:shadow-suave open:ring-menta-borde">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-panel px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-bold text-tinta">{topic.title}</span>
                    <span className="block text-[12.5px] text-tinta-suave">{topic.summary}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className="mt-1 size-4 shrink-0 text-tinta-suave transition-transform group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-3 border-t border-borde px-4 pb-4 pt-3">
                  <ol className="flex flex-col gap-2">
                    {topic.steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-3 text-[13.5px] text-tinta">
                        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-menta text-[12px] font-extrabold text-hoja">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                  {topic.tip ? (
                    <p className="flex items-start gap-2 rounded-xl bg-durazno/60 px-3 py-2.5 text-[12.5px] text-tinta">
                      <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-durazno-texto" />
                      {topic.tip}
                    </p>
                  ) : null}
                  {topic.href ? (
                    <Link href={topic.href} className="inline-flex items-center gap-1.5 self-start rounded-full text-[13px] font-bold text-hoja underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                      Ir a la pantalla
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </Link>
                  ) : null}
                </div>
              </details>
            ))}
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-5 xl:sticky xl:top-6">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-lavanda text-marino">
              <MessageCircleQuestion className="size-[18px]" />
            </span>
            <h2 className="text-base font-bold tracking-tight text-tinta">Preguntas frecuentes</h2>
          </div>
          <dl className="flex flex-col gap-3">
            {guide.faq.map((item) => (
              <div key={item.q} className="rounded-xl bg-crema/70 px-3.5 py-3 ring-1 ring-borde">
                <dt className="text-[13px] font-bold text-tinta">{item.q}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-snug text-tinta-suave">{item.a}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-bold text-tinta">Índice</p>
          <ul className="mt-2 flex flex-col gap-1">
            {guide.groups.flatMap((group) => group.topics).map((topic) => (
              <li key={topic.id}>
                <a href={`#${topic.id}`} className={cn("block truncate rounded-lg px-2 py-1 text-[12.5px] text-tinta-suave hover:bg-menta/60 hover:text-tinta")}>
                  {topic.title}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
