"use client";

import type { ConsoleArea } from "@rapitrip/supabase";
import { Card, Field, cn } from "@rapitrip/ui";
import { ChevronDown, ClipboardCheck, FileCheck2, ListOrdered, Scale, Search, ShieldCheck, UserCheck } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { type ItControl, type ItNorma, type ItPolicy, type ItPolicyManual, type ItProcedure, policyAppliesTo, policyText, procedureAppliesTo, procedurePolicies, procedureText } from "@/content/it-policies";
import { normalizeText } from "@/lib/directory";

type View = "politicas" | "procedimientos";
type Scope = "rol" | "todo";

const chip = (active: boolean) =>
  cn(
    "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
    active ? "bg-hoja text-sobre-acento" : "bg-papel text-tinta ring-1 ring-borde hover:bg-menta/60",
  );

/** Lista numerada del manual (lineamientos, reglas, pasos). */
function Numbered({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-3 text-[13.5px] leading-relaxed text-tinta">
          <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-menta text-[12px] font-extrabold text-hoja">
            {index + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-micro font-bold uppercase tracking-wide text-tinta-suave">{children}</p>;
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {typeof children === "string" ? <p className="text-[13.5px] leading-relaxed text-tinta">{children}</p> : children}
    </div>
  );
}

function ControlBlock({ control }: { control: ItControl }) {
  return (
    <div id={`control-${control.code}`} className="scroll-mt-6 rounded-xl bg-lavanda/50 p-3.5 ring-1 ring-borde">
      <p className="flex items-center gap-2 text-[13.5px] font-bold text-tinta">
        <ClipboardCheck aria-hidden="true" className="size-4 shrink-0 text-marino" />
        Control {control.code}. {control.title}
      </p>
      <dl className="mt-2 flex flex-col gap-2 text-[13px] leading-relaxed">
        {(
          [
            ["Finalidad", control.purpose],
            ["Aplicación", control.application],
            ["Evidencia", control.evidence],
          ] as const
        ).map(([label, text]) => (
          <div key={label}>
            <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
            <dd className="text-tinta">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NormaBlock({ norma }: { norma: ItNorma }) {
  return (
    <section id={`norma-${norma.code}`} aria-label={`Norma ${norma.code}`} className="scroll-mt-6 flex flex-col gap-3 rounded-panel bg-crema/60 p-4 ring-1 ring-borde">
      <div>
        <p className="flex items-center gap-2 text-[14.5px] font-bold text-tinta">
          <Scale aria-hidden="true" className="size-4 shrink-0 text-hoja" />
          Norma {norma.code}. {norma.title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-tinta-suave">{norma.objective}</p>
      </div>
      <Block label="Alcance">{norma.scope}</Block>
      <Block label="Reglas">
        <Numbered items={norma.rules} />
      </Block>
      {norma.responsible ? <Block label="Responsable">{norma.responsible}</Block> : null}
      {norma.controls.map((control) => (
        <ControlBlock key={control.code} control={control} />
      ))}
    </section>
  );
}

const controlCount = (policy: ItPolicy) => policy.normas.reduce((sum, n) => sum + n.controls.length, 0);

function AppliesBadge({ applies }: { applies: boolean }) {
  return applies ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-menta px-2.5 py-0.5 text-[11.5px] font-bold text-hoja">
      <UserCheck aria-hidden="true" className="size-3.5" />
      Te aplica
    </span>
  ) : null;
}

function PolicyCard({ policy, applies, open }: { policy: ItPolicy; applies: boolean; open: boolean }) {
  return (
    <details id={`politica-${policy.number}`} open={open} className="group scroll-mt-6 rounded-panel bg-papel ring-1 ring-borde transition-shadow open:shadow-suave open:ring-menta-borde">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-panel px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-menta text-[15px] font-extrabold text-hoja">
            {policy.number}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold text-tinta">Política {policy.number}. {policy.title}</span>
              <AppliesBadge applies={applies} />
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-tinta-suave">{policy.objective}</span>
            <span className="mt-1 block text-[12px] text-tinta-suave">
              {policy.normas.length} {policy.normas.length === 1 ? "norma" : "normas"} · {controlCount(policy)} {controlCount(policy) === 1 ? "control" : "controles"}
            </span>
          </span>
        </span>
        <ChevronDown aria-hidden="true" className="mt-1 size-4 shrink-0 text-tinta-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-borde px-4 pb-5 pt-4">
        <Block label="Alcance">{policy.scope}</Block>
        <Block label="Lineamientos">
          <Numbered items={policy.guidelines} />
        </Block>
        <Block label="Responsables">
          <ul className="flex flex-col gap-1.5">
            {policy.responsible.map((line) => {
              const [who, ...rest] = line.split(":");
              return (
                <li key={line} className="text-[13.5px] leading-relaxed text-tinta">
                  {rest.length > 0 ? (
                    <>
                      <span className="font-bold">{who}:</span>
                      {rest.join(":")}
                    </>
                  ) : (
                    line
                  )}
                </li>
              );
            })}
          </ul>
        </Block>
        {policy.normas.map((norma) => (
          <NormaBlock key={norma.code} norma={norma} />
        ))}
      </div>
    </details>
  );
}

function ProcedureCard({ procedure, applies, open }: { procedure: ItProcedure; applies: boolean; open: boolean }) {
  return (
    <details id={`procedimiento-${procedure.number}`} open={open} className="group scroll-mt-6 rounded-panel bg-papel ring-1 ring-borde transition-shadow open:shadow-suave open:ring-menta-borde">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-panel px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-lavanda text-[15px] font-extrabold text-marino">
            {procedure.number}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold text-tinta">Procedimiento {procedure.number}. {procedure.title}</span>
              <AppliesBadge applies={applies} />
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-tinta-suave">{procedure.objective}</span>
            <span className="mt-1 block text-[12px] text-tinta-suave">
              {procedure.steps.length} pasos · Política {procedurePolicies(procedure).join(", ")}
            </span>
          </span>
        </span>
        <ChevronDown aria-hidden="true" className="mt-1 size-4 shrink-0 text-tinta-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-borde px-4 pb-5 pt-4">
        <Block label="Alcance">{procedure.scope}</Block>
        <Block label="Responsables">{procedure.responsible}</Block>
        <Block label="Relación con normas y controles">{procedure.relation}</Block>
        <Block label="Pasos">
          <Numbered items={procedure.steps} />
        </Block>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl bg-crema/70 p-3.5 ring-1 ring-borde">
            <Block label="Evidencias">{procedure.evidence}</Block>
          </div>
          <div className="rounded-xl bg-menta/40 p-3.5 ring-1 ring-menta-borde">
            <Block label="Resultado esperado">{procedure.result}</Block>
          </div>
        </div>
      </div>
    </details>
  );
}

/**
 * El Manual de Políticas, Normas, Controles y Procedimientos de TI dentro de la consola: buscador, filtro por lo que le toca
 * al rol y las dos partes del manual (políticas con sus normas y controles, y procedimientos), con un índice al costado.
 */
export function PolicyManual({ manual, area, roleLabel }: { manual: ItPolicyManual; area: ConsoleArea; roleLabel: string }) {
  const [view, setView] = useState<View>("politicas");
  const [scope, setScope] = useState<Scope>(area === "admin" ? "todo" : "rol");
  const [query, setQuery] = useState("");
  const needle = normalizeText(query);

  const policies = useMemo(
    () => manual.policies.filter((policy) => (scope === "todo" || policyAppliesTo(policy.number, area)) && (!needle || policyText(policy).includes(needle))),
    [manual, scope, area, needle],
  );
  const procedures = useMemo(
    () => manual.procedures.items.filter((procedure) => (scope === "todo" || procedureAppliesTo(procedure, area)) && (!needle || procedureText(procedure).includes(needle))),
    [manual, scope, area, needle],
  );
  const mine = { policies: manual.policies.filter((p) => policyAppliesTo(p.number, area)).length, procedures: manual.procedures.items.filter((p) => procedureAppliesTo(p, area)).length };
  const shown = view === "politicas" ? policies.length : procedures.length;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-menta text-hoja">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-micro font-bold uppercase text-hoja">Políticas de TI · {manual.date}</p>
              <h2 className="text-[17px] font-bold leading-snug text-tinta">{manual.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-tinta-suave">
                Es el marco que rige el uso de la consola y de las apps de Rapitrip. «Te aplica» marca lo que le toca a {roleLabel}; la administración responde por todo el manual.
              </p>
              <p className="mt-1.5 text-[12.5px] text-tinta-suave">
                En él se basan los{" "}
                <a href="/terminos" className="font-bold text-hoja underline-offset-2 hover:underline">
                  Términos de uso
                </a>{" "}
                y la{" "}
                <a href="/privacidad" className="font-bold text-hoja underline-offset-2 hover:underline">
                  Política de privacidad
                </a>{" "}
                de la consola.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" aria-label="Parte del manual" className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={view === "politicas"} onClick={() => setView("politicas")} className={chip(view === "politicas")}>
                <Scale aria-hidden="true" className="size-4" />
                Políticas y normas
              </button>
              <button type="button" aria-pressed={view === "procedimientos"} onClick={() => setView("procedimientos")} className={chip(view === "procedimientos")}>
                <ListOrdered aria-hidden="true" className="size-4" />
                Procedimientos
              </button>
            </div>
            <div className="w-full lg:w-72">
              <Field label="Buscar en el manual" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar: contraseña, respaldo, pedido…" />
            </div>
          </div>
          <div role="group" aria-label="Qué mostrar" className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={scope === "rol"} onClick={() => setScope("rol")} className={chip(scope === "rol")}>
              Lo que aplica a mi rol ({view === "politicas" ? mine.policies : mine.procedures})
            </button>
            <button type="button" aria-pressed={scope === "todo"} onClick={() => setScope("todo")} className={chip(scope === "todo")}>
              Todo el manual ({view === "politicas" ? manual.policies.length : manual.procedures.items.length})
            </button>
          </div>
          {needle ? (
            <p role="status" className="mt-2 text-[12.5px] text-tinta-suave">
              {shown === 0 ? "Nada coincide con la búsqueda." : `${shown} ${view === "politicas" ? (shown === 1 ? "política" : "políticas") : shown === 1 ? "procedimiento" : "procedimientos"}`}
            </p>
          ) : null}
        </Card>

        {view === "politicas" ? (
          policies.map((policy) => <PolicyCard key={policy.number} policy={policy} applies={policyAppliesTo(policy.number, area)} open={Boolean(needle)} />)
        ) : (
          <>
            <Card className="p-5">
              <Block label="Objetivo de los procedimientos">{manual.procedures.objective}</Block>
              <div className="mt-3">
                <Block label="Alcance">{[manual.procedures.scope, ...manual.procedures.intro].join(" ")}</Block>
              </div>
            </Card>
            {procedures.map((procedure) => (
              <ProcedureCard key={procedure.number} procedure={procedure} applies={procedureAppliesTo(procedure, area)} open={Boolean(needle)} />
            ))}
          </>
        )}
      </div>

      <Card outerClassName="xl:sticky xl:top-6" className="p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold text-tinta">
          <FileCheck2 aria-hidden="true" className="size-4 text-hoja" />
          Índice
        </p>
        <ul className="mt-2 flex flex-col gap-0.5">
          {(view === "politicas" ? policies.map((p) => ({ id: `politica-${p.number}`, label: `${p.number}. ${p.title}` })) : procedures.map((p) => ({ id: `procedimiento-${p.number}`, label: `${p.number}. ${p.title}` }))).map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="block rounded-lg px-2 py-1 text-[12.5px] leading-snug text-tinta-suave hover:bg-menta/60 hover:text-tinta">
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
