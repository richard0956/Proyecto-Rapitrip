"use client";

import { Alert, Badge, Button, Card, CardHeader, TextareaField } from "@rapitrip/ui";
import { CalendarCheck, ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

export type AccessReviewRow = { id: string; reviewedAt: string; reviewer: string; findings: string; changes: string | null; summary: string };
export type RoleCount = { role: string; active: number; suspended: number };

/**
 * Norma 1.1.6 del manual de políticas de TI: cada tres meses la administración revisa los accesos de cada rol y verifica que
 * correspondan a las funciones vigentes. Aquí se ve cuándo toca, el estado actual por rol, y se deja constancia de la revisión.
 */
export function AccessReview({
  lastAt,
  dueAt,
  overdue,
  counts,
  history,
  record,
}: {
  lastAt: string | null;
  dueAt: string;
  overdue: boolean;
  counts: RoleCount[];
  history: AccessReviewRow[];
  record: (input: { findings: string; changes: string }) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [findings, setFindings] = useState("");
  const [changes, setChanges] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    start(async () => {
      const outcome = await record({ findings: findings.trim(), changes: changes.trim() });
      setResult(outcome);
      if (outcome.ok) {
        setFindings("");
        setChanges("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-menta text-hoja">
                <CalendarCheck className="size-[18px]" />
              </span>
              <div>
                <h2 className="text-base font-bold text-tinta">Revisión trimestral de accesos</h2>
                <p className="text-[12.5px] leading-snug text-tinta-suave">
                  Cada tres meses, revisa que cada cuenta tenga solo el rol que necesita hoy (Norma 1.1.6). Suspende o revoca lo que ya no corresponda desde la pestaña «Cuentas» y deja constancia aquí.
                </p>
              </div>
            </div>
            <Badge tone={overdue ? "danger" : "positive"}>{overdue ? (lastAt ? "Toca revisar" : "Nunca se ha revisado") : `Próxima: ${dueAt}`}</Badge>
          </div>
          <p className="mt-3 text-[13px] text-tinta">{lastAt ? `Última revisión: ${lastAt}.` : "Todavía no hay revisiones registradas."}</p>

          <table className="mt-4 w-full text-[13px]">
            <caption className="sr-only">Cuentas por rol y estado</caption>
            <thead>
              <tr className="text-left text-micro uppercase text-tinta-suave">
                <th className="pb-2 font-bold">Rol</th>
                <th className="pb-2 text-right font-bold">Activas</th>
                <th className="pb-2 text-right font-bold">Suspendidas</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((row) => (
                <tr key={row.role} className="border-t border-borde">
                  <td className="py-2 font-semibold text-tinta">{row.role}</td>
                  <td className="py-2 text-right tabular-nums">{row.active}</td>
                  <td className="py-2 text-right tabular-nums text-tinta-suave">{row.suspended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <CardHeader title="Registrar la revisión" subtitle="Queda como evidencia del control y no se puede modificar después." />
          <form onSubmit={submit} className="flex flex-col gap-4">
            <TextareaField label="¿Qué revisaste y qué encontraste?" value={findings} maxLength={2000} onChange={(e) => setFindings(e.target.value)} placeholder="Revisé cada cuenta del equipo y de los comercios; todas corresponden a su función, salvo…" required />
            <TextareaField label="Cambios que hiciste (opcional)" value={changes} maxLength={2000} onChange={(e) => setChanges(e.target.value)} placeholder="Revoqué el rol de cajero de…, suspendí…" />
            {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? "Revisión registrada. La próxima toca en tres meses." : result.error}</Alert> : null}
            <Button variant="primary" type="submit" disabled={pending || findings.trim().length < 10} className="self-start">
              <ClipboardCheck aria-hidden="true" className="size-4" />
              {pending ? "Guardando…" : "Registrar revisión"}
            </Button>
          </form>
        </Card>
      </div>

      <Card className="p-5">
        <CardHeader title="Historial" subtitle="Las últimas revisiones registradas" />
        {history.length === 0 ? (
          <p className="text-[13px] text-tinta-suave">Sin revisiones todavía.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {history.map((row) => (
              <li key={row.id} className="rounded-panel bg-crema/70 p-3.5 ring-1 ring-borde">
                <p className="text-[13px] font-bold text-tinta">{row.reviewedAt}</p>
                <p className="text-[12px] text-tinta-suave">{row.reviewer} · {row.summary}</p>
                <p className="mt-1.5 text-[12.5px] leading-snug text-tinta">{row.findings}</p>
                {row.changes ? <p className="mt-1 text-[12.5px] leading-snug text-tinta-suave">Cambios: {row.changes}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
