"use client";

import { Alert, Badge, Button, Card, CardHeader, Field, SelectField, TextareaField, cn } from "@rapitrip/ui";
import { Banknote, CalendarCheck, History, Scale } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DueBadge } from "@/components/sla-badge";
import type { ActionResult } from "@/lib/action-error";
import { formatMoney } from "@/lib/money";

export type CommerceSettlement = {
  commerceId: string;
  name: string;
  pendingOrders: number;
  pendingAmount: number;
  pendingReversals: number;
  commissionPct: number;
  periodDays: number;
  bearer: "comercio" | "rapitrip";
  lastSettledAt: string | null;
  dueIso: string | null;
};
export type SettlementRow = { id: string; number: number; commerce: string; orders: number; gross: number; commission: number; reversals: number; net: number; reference: string | null; createdAt: string };
export type ReconciliationSummary = {
  month: string;
  charged: number;
  chargedOrders: number;
  settled: number;
  commission: number;
  reversed: number;
  netPaid: number;
  overdueUnsettled: number;
  pendingReversals: number;
  mismatched: number;
  lastReconciledAt: string | null;
};
export type ReconciliationRow = { id: string; month: string; doneAt: string; doneBy: string; differences: string; corrections: string | null };

type Actions = {
  saveAgreement: (input: { commerceId: string; commissionPct: number; periodDays: number; bearer: "comercio" | "rapitrip" }) => Promise<ActionResult>;
  recordSettlement: (input: { commerceId: string; reference?: string }) => Promise<ActionResult>;
  recordReconciliation: (input: { month: string; differences: string; corrections?: string }) => Promise<ActionResult>;
};

type Tab = "pendientes" | "historial" | "conciliacion";

function CommerceRow({ row, actions }: { row: CommerceSettlement; actions: Actions }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pct, setPct] = useState(String(row.commissionPct));
  const [days, setDays] = useState(String(row.periodDays));
  const [bearer, setBearer] = useState(row.bearer);
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const net = row.pendingAmount - row.pendingReversals;
  const run = (action: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <li className="flex flex-col gap-3 rounded-panel bg-papel p-4 ring-1 ring-borde">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-tinta">{row.name}</p>
          <p className="text-[12.5px] text-tinta-suave">
            Convenio: {row.commissionPct} % de comisión · cada {row.periodDays} {row.periodDays === 1 ? "día" : "días"} · devoluciones a cargo {row.bearer === "comercio" ? "del comercio" : "de Rapitrip"}
            {row.lastSettledAt ? ` · última liquidación ${row.lastSettledAt}` : " · nunca liquidado"}
          </p>
        </div>
        {row.dueIso && (row.pendingOrders > 0 || row.pendingReversals > 0) ? <DueBadge due={row.dueIso} title={`Liquidación cada ${row.periodDays} días (Norma 9.1.3)`} /> : <Badge tone="neutral">Al día</Badge>}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Pedidos por liquidar", String(row.pendingOrders)],
            ["Monto (sin comisión)", formatMoney(row.pendingAmount)],
            ["Reversiones a descontar", formatMoney(row.pendingReversals)],
            ["Neto a pagar", formatMoney(net)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-crema/70 px-3 py-2 ring-1 ring-borde">
            <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
            <dd className={cn("text-[15px] font-bold tabular-nums", label === "Neto a pagar" && net < 0 ? "text-rojo" : "text-tinta")}>{value}</dd>
          </div>
        ))}
      </dl>
      {net < 0 ? <Alert tone="warning">Las reversiones superan lo pendiente: el comercio le debe a Rapitrip {formatMoney(-net)}. Puedes esperar a la siguiente liquidación.</Alert> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:flex-1">
          <Field label="Referencia del pago (opcional)" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Transferencia, cheque…" />
        </div>
        <Button variant="primary" disabled={pending || (row.pendingOrders === 0 && row.pendingReversals === 0)} onClick={() => run(() => actions.recordSettlement({ commerceId: row.commerceId, ...(reference.trim() ? { reference: reference.trim() } : {}) }), () => setReference(""))}>
          <Banknote aria-hidden="true" className="size-4" />
          Registrar liquidación
        </Button>
        <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cerrar convenio" : "Editar convenio"}
        </Button>
      </div>

      {editing ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-lavanda/40 p-3.5 ring-1 ring-borde sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
          <Field label="Comisión (%)" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.]/g, ""))} />
          <Field label="Cada cuántos días (máx. 15)" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
          <SelectField label="Costo de las devoluciones" value={bearer} onChange={(e) => setBearer(e.target.value as "comercio" | "rapitrip")}>
            <option value="comercio">Lo asume el comercio (se revierte)</option>
            <option value="rapitrip">Lo asume Rapitrip</option>
          </SelectField>
          <Button variant="secondary" disabled={pending} onClick={() => run(() => actions.saveAgreement({ commerceId: row.commerceId, commissionPct: Number(pct), periodDays: Number(days), bearer }), () => setEditing(false))}>
            Guardar convenio
          </Button>
        </div>
      ) : null}
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
    </li>
  );
}

function Reconciliation({ summary, history, months, record }: { summary: ReconciliationSummary; history: ReconciliationRow[]; months: { value: string; label: string }[]; record: Actions["recordReconciliation"] }) {
  const router = useRouter();
  const [differences, setDifferences] = useState("");
  const [corrections, setCorrections] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const issues = summary.overdueUnsettled + summary.pendingReversals + summary.mismatched;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-tinta">Conciliación de {months.find((m) => m.value === summary.month)?.label ?? summary.month}</h2>
            <p className="text-[12.5px] text-tinta-suave">Cobros, liquidaciones y reversiones del mes. Corrige las diferencias antes del cierre (Control 9.1.1).</p>
          </div>
          <nav aria-label="Mes" className="flex flex-wrap gap-1.5">
            {months.map((m) => (
              <Link key={m.value} href={`/admin/liquidaciones?vista=conciliacion&mes=${m.value}`} className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-bold", m.value === summary.month ? "bg-hoja text-sobre-acento" : "bg-papel text-tinta ring-1 ring-borde")}>
                {m.label}
              </Link>
            ))}
          </nav>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(
            [
              ["Cobrado a clientes", `${formatMoney(summary.charged)} · ${summary.chargedOrders} pedidos`],
              ["Liquidado a comercios", formatMoney(summary.settled)],
              ["Comisión de Rapitrip", formatMoney(summary.commission)],
              ["Reversiones aplicadas", formatMoney(summary.reversed)],
              ["Neto pagado", formatMoney(summary.netPaid)],
              ["Última conciliación", summary.lastReconciledAt ?? "Sin conciliar"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-crema/70 px-3 py-2.5 ring-1 ring-borde">
              <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
              <dd className="text-[14.5px] font-bold tabular-nums text-tinta">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          {issues === 0 ? (
            <Alert tone="info">No hay diferencias: todo lo cobrado está liquidado a tiempo y no quedan reversiones pendientes.</Alert>
          ) : (
            <Alert tone="warning">
              <ul className="list-disc pl-4">
                {summary.overdueUnsettled > 0 ? <li>{summary.overdueUnsettled === 1 ? "1 pedido cobrado sigue" : `${summary.overdueUnsettled} pedidos cobrados siguen`} sin liquidar pasado el plazo del convenio.</li> : null}
                {summary.pendingReversals > 0 ? <li>{summary.pendingReversals === 1 ? "1 reversión espera" : `${summary.pendingReversals} reversiones esperan`} descontarse en la siguiente liquidación.</li> : null}
                {summary.mismatched > 0 ? <li>{summary.mismatched === 1 ? "1 pedido liquidado no cuadra" : `${summary.mismatched} pedidos liquidados no cuadran`} con su subtotal.</li> : null}
              </ul>
            </Alert>
          )}
        </div>
        <form
          className="mt-4 flex flex-col gap-3 border-t border-borde pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const outcome = await record({ month: summary.month, differences: differences.trim(), ...(corrections.trim() ? { corrections: corrections.trim() } : {}) });
              setResult(outcome);
              if (outcome.ok) {
                setDifferences("");
                setCorrections("");
                router.refresh();
              }
            });
          }}
        >
          <TextareaField label="Diferencias encontradas" rows={2} maxLength={2000} value={differences} onChange={(e) => setDifferences(e.target.value)} placeholder={issues === 0 ? "Ninguna" : "Describe cada diferencia"} required />
          <TextareaField label="Correcciones aplicadas (opcional)" rows={2} maxLength={2000} value={corrections} onChange={(e) => setCorrections(e.target.value)} />
          {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
          <Button variant="primary" type="submit" disabled={pending || differences.trim().length < 2} className="self-start">
            <Scale aria-hidden="true" className="size-4" />
            Registrar conciliación
          </Button>
        </form>
      </Card>
      <Card className="p-5">
        <CardHeader title="Conciliaciones registradas" />
        {history.length === 0 ? (
          <p className="text-[13px] text-tinta-suave">Todavía no hay conciliaciones.</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {history.map((row) => (
              <li key={row.id} className="rounded-panel bg-crema/70 p-3 ring-1 ring-borde">
                <p className="text-[13px] font-bold text-tinta">{row.month}</p>
                <p className="text-[12px] text-tinta-suave">{row.doneAt} · {row.doneBy}</p>
                <p className="mt-1 text-[12.5px] text-tinta">Diferencias: {row.differences}</p>
                {row.corrections ? <p className="text-[12.5px] text-tinta-suave">Correcciones: {row.corrections}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

/** Liquidaciones a comercios (Política 9): lo pendiente por comercio con su convenio, el historial y la conciliación mensual. */
export function SettlementsWorkspace({
  initialTab,
  commerces,
  history,
  summary,
  reconciliations,
  months,
  actions,
}: {
  initialTab: Tab;
  commerces: CommerceSettlement[];
  history: SettlementRow[];
  summary: ReconciliationSummary;
  reconciliations: ReconciliationRow[];
  months: { value: string; label: string }[];
  actions: Actions;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const withPending = commerces.filter((c) => c.pendingOrders > 0 || c.pendingReversals > 0);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? commerces : withPending;
  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "pendientes", label: "Por liquidar", icon: <Banknote aria-hidden="true" className="size-4" />, count: withPending.length },
    { key: "historial", label: "Historial", icon: <History aria-hidden="true" className="size-4" /> },
    { key: "conciliacion", label: "Conciliación mensual", icon: <CalendarCheck aria-hidden="true" className="size-4" /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Secciones de liquidaciones" className="flex flex-wrap gap-2">
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
            {item.count ? <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] tabular-nums", tab === item.key ? "bg-white/20" : "bg-durazno text-durazno-texto")}>{item.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "pendientes" ? (
        <Card className="p-5">
          <CardHeader
            title="Por liquidar"
            subtitle="Pedidos entregados y cobrados, menos la comisión del convenio y las reversiones por devoluciones (Normas 9.1 y 9.2)."
            actions={
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-tinta-suave">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="size-4 accent-hoja" />
                Ver todos los comercios
              </label>
            }
          />
          {shown.length === 0 ? (
            <p className="rounded-panel bg-menta/40 px-4 py-3 text-[13px] text-tinta">No hay nada por liquidar.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((row) => (
                <CommerceRow key={row.commerceId} row={row} actions={actions} />
              ))}
            </ul>
          )}
        </Card>
      ) : tab === "historial" ? (
        <Card className="p-5">
          <CardHeader title="Liquidaciones registradas" subtitle="Cada una queda con sus pedidos, montos y fecha; no se modifican." />
          {history.length === 0 ? (
            <p className="text-[13px] text-tinta-suave">Todavía no hay liquidaciones.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <caption className="sr-only">Liquidaciones registradas</caption>
                <thead>
                  <tr className="text-left text-micro uppercase text-tinta-suave">
                    {["N.°", "Comercio", "Fecha", "Pedidos", "Vendido", "Comisión", "Reversiones", "Neto", "Referencia"].map((h) => (
                      <th key={h} className="pb-2 pr-3 font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t border-borde">
                      <td className="py-2 pr-3 font-bold tabular-nums">{row.number}</td>
                      <td className="py-2 pr-3">{row.commerce}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{row.createdAt}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.orders}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatMoney(row.gross)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatMoney(row.commission)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatMoney(row.reversals)}</td>
                      <td className="py-2 pr-3 font-bold tabular-nums">{formatMoney(row.net)}</td>
                      <td className="py-2 pr-3 text-tinta-suave">{row.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Reconciliation summary={summary} history={reconciliations} months={months} record={actions.recordReconciliation} />
      )}
    </div>
  );
}
