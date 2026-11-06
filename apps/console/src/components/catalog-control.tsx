"use client";

import { Alert, Badge, Button, Card, CardHeader, Field, TextareaField, cn } from "@rapitrip/ui";
import { CalendarCheck, Flag, Gavel } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";
import { SlaBadge } from "./sla-badge";

export type CatalogReport = {
  id: string;
  commerce: string;
  store: string;
  product: string;
  source: "cliente" | "equipo";
  kind: string;
  description: string;
  status: "recibido" | "descartado" | "confirmado" | "corregido";
  createdAt: string;
  createdIso: string;
  reviewNote: string | null;
  fixDueIso: string | null;
  correctionNote: string | null;
};
export type StaleCatalog = { commerceId: string; name: string; lastUpdate: string | null; days: number | null };
export type CatalogReviewEntry = { id: string; reviewedAt: string; reviewer: string; found: number; notes: string | null };
export type Recurrence = { commerceId: string; commerce: string; confirmed: number; flaggedIso: string; lastMeasure: string | null };

const kindLabel: Record<string, string> = { precio: "Precio", disponibilidad: "Disponibilidad", descripcion: "Descripción", imagen: "Fotos", otro: "Otro" };
const statusText: Record<CatalogReport["status"], string> = { recibido: "Por revisar", descartado: "Descartado", confirmado: "Esperando corrección", corregido: "Corregido" };
const statusTone: Record<CatalogReport["status"], "warning" | "neutral" | "danger" | "positive"> = { recibido: "warning", descartado: "neutral", confirmado: "danger", corregido: "positive" };

type Actions = {
  review: (input: { id: string; confirmed: boolean; note: string }) => Promise<ActionResult>;
  recordReview: (input: { notes?: string }) => Promise<ActionResult>;
  recordMeasure?: (input: { commerceId: string; measure: string; note?: string }) => Promise<ActionResult>;
};

type Tab = "reportes" | "semanal" | "reincidencias";

/** Un reporte: se revisa en 24 horas (confirmar o descartar, con lo encontrado); confirmado, el comercio tiene 24 horas para corregirlo. */
function ReportItem({ report, review }: { report: CatalogReport; review: Actions["review"] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const decide = (confirmed: boolean) =>
    start(async () => {
      setError(null);
      const result = await review({ id: report.id, confirmed, note: note.trim() });
      if (!result.ok) return setError(result.error);
      router.refresh();
    });

  return (
    <li className="flex flex-col gap-2.5 rounded-panel bg-papel p-4 ring-1 ring-borde">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-tinta">
            {report.product} <span className="font-normal text-tinta-suave">· {report.store} · {report.commerce}</span>
          </p>
          <p className="text-[12px] text-tinta-suave">
            {kindLabel[report.kind] ?? report.kind} · {report.source === "cliente" ? "lo reportó un cliente" : "lo reportó el equipo"} · {report.createdAt}
          </p>
        </div>
        <span className="flex flex-wrap items-center gap-1.5">
          {report.status === "recibido" ? <SlaBadge kind="reporte" from={report.createdIso} /> : null}
          {report.status === "confirmado" && report.fixDueIso ? <SlaBadge kind="correccion" from={new Date(new Date(report.fixDueIso).getTime() - 24 * 3_600_000).toISOString()} /> : null}
          <Badge tone={statusTone[report.status]}>{statusText[report.status]}</Badge>
        </span>
      </div>
      <p className="text-[13.5px] text-tinta">«{report.description}»</p>
      {report.reviewNote ? <p className="text-[12.5px] text-tinta-suave">Revisión: {report.reviewNote}</p> : null}
      {report.correctionNote ? <p className="text-[12.5px] text-tinta-suave">Corrección del comercio: {report.correctionNote}</p> : null}
      {report.status === "recibido" ? (
        <div className="flex flex-col gap-2">
          <Field label="¿Qué encontraste?" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Comparé con el comercio y…" />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" className="min-h-9 px-3.5" disabled={pending || note.trim().length < 5} onClick={() => decide(true)}>
              Confirmar y avisar al comercio
            </Button>
            <Button variant="ghost" className="min-h-9 px-3.5" disabled={pending || note.trim().length < 5} onClick={() => decide(false)}>
              Descartar
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function WeeklyReview({ stale, history, status, record }: { stale: StaleCatalog[]; history: CatalogReviewEntry[]; status: { lastAt: string | null; dueAt: string; overdue: boolean }; record: Actions["recordReview"] }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    start(async () => {
      const outcome = await record(notes.trim() ? { notes: notes.trim() } : {});
      setResult(outcome);
      if (outcome.ok) {
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-tinta">Catálogos sin actualizar</h2>
            <p className="text-[12.5px] text-tinta-suave">Comercios sin cambios en productos, precios o inventario hace más de 2 días (Control 8.1.1).</p>
          </div>
          <Badge tone={status.overdue ? "danger" : "positive"}>{status.overdue ? "Toca la revisión semanal" : `Próxima: ${status.dueAt}`}</Badge>
        </div>
        {stale.length === 0 ? (
          <p className="rounded-panel bg-menta/40 px-4 py-3 text-[13px] text-tinta">Todos los catálogos se actualizaron en los últimos 2 días.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {stale.map((row) => (
              <li key={row.commerceId} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                <span className="font-semibold text-tinta">{row.name}</span>
                <span className="text-tinta-suave">{row.days === null ? "Sin productos ni inventario" : `${row.days} días sin actualizar · ${row.lastUpdate}`}</span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 border-t border-borde pt-4">
          <TextareaField label="Notas de la revisión (opcional)" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Llamé a…, quedaron de actualizar…" />
          {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
          <Button variant="primary" type="submit" disabled={pending} className="self-start">
            <CalendarCheck aria-hidden="true" className="size-4" />
            {pending ? "Guardando…" : stale.length > 0 ? "Registrar revisión y avisar a los comercios" : "Registrar revisión"}
          </Button>
        </form>
      </Card>
      <Card className="p-5">
        <CardHeader title="Revisiones anteriores" subtitle={status.lastAt ? `Última: ${status.lastAt}` : "Todavía no hay revisiones"} />
        <ol className="flex flex-col gap-2.5">
          {history.map((row) => (
            <li key={row.id} className="rounded-panel bg-crema/70 p-3 ring-1 ring-borde">
              <p className="text-[13px] font-bold text-tinta">{row.reviewedAt}</p>
              <p className="text-[12px] text-tinta-suave">
                {row.reviewer} · {row.found === 0 ? "todos al día" : `${row.found} ${row.found === 1 ? "comercio avisado" : "comercios avisados"}`}
              </p>
              {row.notes ? <p className="mt-1 text-[12.5px] text-tinta">{row.notes}</p> : null}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function RecurrenceItem({ row, record }: { row: Recurrence; record: NonNullable<Actions["recordMeasure"]> }) {
  const router = useRouter();
  const [measure, setMeasure] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-col gap-3 rounded-panel bg-papel p-4 ring-1 ring-borde">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-bold text-tinta">
          {row.commerce} <span className="font-normal text-tinta-suave">· {row.confirmed} inconsistencias confirmadas en 90 días</span>
        </p>
        <SlaBadge kind="medida" from={row.flaggedIso} />
      </div>
      {row.lastMeasure ? <p className="text-[12.5px] text-tinta-suave">Medida anterior: {row.lastMeasure}</p> : null}
      <Field label="Medida" value={measure} maxLength={300} onChange={(e) => setMeasure(e.target.value)} placeholder="Advertencia, revisión diaria, suspensión temporal…" />
      <TextareaField label="Nota (opcional)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button
        variant="primary"
        className="self-start"
        disabled={pending || measure.trim().length < 5}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await record({ commerceId: row.commerceId, measure: measure.trim(), ...(note.trim() ? { note: note.trim() } : {}) });
            if (!result.ok) return setError(result.error);
            router.refresh();
          })
        }
      >
        <Gavel aria-hidden="true" className="size-4" />
        Registrar medida y avisar al comercio
      </Button>
    </li>
  );
}

/**
 * Control de catálogos (Política 8 del manual de políticas de TI): reportes de inconsistencias, revisión semanal de catálogos
 * sin actualizar y, para la administración, las reincidencias que esperan una medida.
 */
export function CatalogControl({
  reports,
  stale,
  history,
  reviewStatus,
  recurrences,
  actions,
}: {
  reports: CatalogReport[];
  stale: StaleCatalog[];
  history: CatalogReviewEntry[];
  reviewStatus: { lastAt: string | null; dueAt: string; overdue: boolean };
  recurrences: Recurrence[] | null;
  actions: Actions;
}) {
  const [tab, setTab] = useState<Tab>("reportes");
  const [showClosed, setShowClosed] = useState(false);
  const open = reports.filter((r) => r.status === "recibido" || r.status === "confirmado");
  const shown = showClosed ? reports : open;
  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "reportes", label: "Reportes", count: open.length, icon: <Flag aria-hidden="true" className="size-4" /> },
    { key: "semanal", label: "Revisión semanal", count: reviewStatus.overdue ? 1 : 0, icon: <CalendarCheck aria-hidden="true" className="size-4" /> },
    ...(recurrences ? [{ key: "reincidencias" as const, label: "Reincidencias", count: recurrences.length, icon: <Gavel aria-hidden="true" className="size-4" /> }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Secciones del control de catálogos" className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
              tab === item.key ? "bg-hoja text-sobre-acento shadow-pulsa" : "bg-papel text-tinta ring-1 ring-borde hover:bg-menta/60",
            )}
          >
            {item.icon}
            {item.label}
            {item.count > 0 ? <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] tabular-nums", tab === item.key ? "bg-white/20" : "bg-durazno text-durazno-texto")}>{item.key === "semanal" ? "Toca" : item.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "reportes" ? (
        <Card className="p-5">
          <CardHeader
            title="Reportes de inconsistencias"
            subtitle="Se revisan en 24 horas. Si se confirman, el comercio tiene 24 horas más para corregir (Norma 8.2)."
            actions={
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-tinta-suave">
                <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="size-4 accent-hoja" />
                Ver también los cerrados
              </label>
            }
          />
          {shown.length === 0 ? (
            <p className="rounded-panel bg-menta/40 px-4 py-3 text-[13px] text-tinta">No hay reportes pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((report) => (
                <ReportItem key={report.id} report={report} review={actions.review} />
              ))}
            </ul>
          )}
        </Card>
      ) : tab === "semanal" ? (
        <WeeklyReview stale={stale} history={history} status={reviewStatus} record={actions.recordReview} />
      ) : recurrences && actions.recordMeasure ? (
        <Card className="p-5">
          <CardHeader title="Reincidencias" subtitle="Comercios con dos o más inconsistencias confirmadas en 90 días. Decide la medida en 5 días hábiles (Control 8.2.1)." />
          {recurrences.length === 0 ? (
            <p className="rounded-panel bg-menta/40 px-4 py-3 text-[13px] text-tinta">Ningún comercio está reincidiendo.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {recurrences.map((row) => (
                <RecurrenceItem key={row.commerceId} row={row} record={actions.recordMeasure!} />
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
