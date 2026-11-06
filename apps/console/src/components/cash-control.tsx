"use client";

import { Alert, Badge, Button, Card, CardHeader, DataTable, Dialog, EmptyState, Field, KpiCard, cn, pillStyles, type Column } from "@rapitrip/ui";
import { AlertTriangle, Scale, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Countdown } from "@/components/countdown";
import { SlaBadge } from "@/components/sla-badge";
import type { ActionResult } from "@/lib/action-error";
import type { AccountabilityRow, CashPoint, CustodyRow, HandoffRow } from "@/lib/load-cash-control";
import { formatMoney } from "@/lib/money";

export const accountabilityLabels: Record<string, string> = {
  entrega_vencida: "Entrega sin confirmar a tiempo",
  entrega_rechazada: "Entrega rechazada por caja",
  faltante_entrega: "Faltante al entregar",
  sobrante_entrega: "Sobrante al entregar",
  efectivo_retenido: "Efectivo retenido de más",
  faltante_arqueo: "Faltante en el arqueo",
  sobrante_arqueo: "Sobrante en el arqueo",
};

export const decisionLabels: Record<string, string> = {
  sin_medida: "Sin medida",
  llamado_atencion: "Llamado de atención",
  reposicion: "Reposición del faltante",
  suspension: "Suspensión",
};

const handoffStatus: Record<string, { tone: "positive" | "warning" | "danger" | "neutral"; label: string }> = {
  pendiente: { tone: "neutral", label: "Esperando al cajero" },
  confirmada: { tone: "positive", label: "Confirmada" },
  con_diferencia: { tone: "warning", label: "Con diferencia" },
  rechazada: { tone: "danger", label: "Rechazada" },
  vencida: { tone: "danger", label: "Vencida" },
};

/** Cifras de arriba: efectivo en la calle, repartidores frenados y responsabilidades por decidir. */
export function CashKpis({ custody, open }: { custody: CustodyRow[]; open: AccountabilityRow[] }) {
  const total = custody.reduce((sum, row) => sum + row.total, 0);
  const blocked = custody.filter((row) => row.blocked).length;
  const openAmount = open.reduce((sum, row) => sum + row.amount, 0);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard icon={<Wallet className="size-5" />} tone="durazno" label="Efectivo a cargo de repartidores" value={formatMoney(total)} hint={`${custody.length} ${custody.length === 1 ? "repartidor" : "repartidores"}`} />
      <KpiCard icon={<AlertTriangle className="size-5" />} label="Sin pedidos en efectivo" value={String(blocked)} hint={blocked === 0 ? "Nadie pasó los límites" : "Pasaron el monto o el tiempo máximo"} />
      <KpiCard icon={<Scale className="size-5" />} tone="lavanda" label="Responsabilidades abiertas" value={String(open.length)} hint={open.length === 0 ? "Nada por decidir" : `${formatMoney(openAmount)} en total`} />
    </div>
  );
}

/** Efectivo a cargo de cada repartidor. Para quien no tiene cuenta, coordinación envía la entrega a una caja abierta. */
export function CustodyCard({ rows, points, start }: { rows: CustodyRow[]; points: CashPoint[]; start?: (courierId: string, sessionId: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [target, setTarget] = useState<CustodyRow | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();

  function send(event: FormEvent) {
    event.preventDefault();
    if (!target || !start) return;
    setError(null);
    run(async () => {
      const result = await start(target.courierId, sessionId);
      if (!result.ok) return setError(result.error);
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Efectivo a cargo de repartidores" subtitle="Desde que entregan un pedido en efectivo hasta que un cajero lo cuenta y lo confirma." />
      {rows.length === 0 ? (
        <EmptyState title="Ningún repartidor tiene efectivo">Todo el efectivo cobrado ya está en caja.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {rows.map((row) => (
            <li key={row.courierId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">
                  {row.name} · {formatMoney(row.total)}
                </span>
                <span className="block text-xs text-tinta-suave">
                  {row.orders} {row.orders === 1 ? "pedido" : "pedidos"}
                  {row.oldest ? ` · el más antiguo, entregado ${row.oldest}` : ""}
                  {row.hasAccount ? "" : " · sin cuenta"}
                </span>
                {row.blocked ? <span className="mt-1 block text-xs font-bold text-durazno-texto">No recibe pedidos en efectivo: {row.blocked}</span> : null}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {row.pendingExpiresAt ? (
                  <>
                    <Badge tone="neutral">En {row.pendingRegister}</Badge>
                    <Countdown until={row.pendingExpiresAt} />
                  </>
                ) : !row.hasAccount && start ? (
                  <Button
                    variant="secondary"
                    className="min-h-9 px-3"
                    disabled={points.length === 0}
                    onClick={() => {
                      setTarget(row);
                      setSessionId(points[0]?.sessionId ?? "");
                      setError(null);
                    }}
                  >
                    Enviar a caja
                  </Button>
                ) : (
                  <Badge tone="warning">Por entregar</Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={target !== null} onClose={() => setTarget(null)} title={target ? `Entregar el efectivo de ${target.name}` : "Entregar efectivo"}>
        <form onSubmit={send} className="flex flex-col gap-3.5" noValidate>
          <p className="text-sm text-tinta-suave">El repartidor no tiene cuenta, así que envías tú la entrega. El cajero de esa caja contará el efectivo y lo confirmará en el tiempo límite.</p>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-tinta">
            Caja
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="min-h-11 rounded-campo border border-borde-campo bg-papel px-3 text-sm font-semibold text-tinta">
              {points.map((point) => (
                <option key={point.sessionId} value={point.sessionId}>
                  {point.label}
                </option>
              ))}
            </select>
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={busy || !sessionId}>
              {busy ? "Enviando…" : "Enviar a caja"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

/**
 * Responsabilidades de efectivo a nombre de una persona. Coordinación las ve; la administración decide la medida en 5 días
 * hábiles (Control 8.2.1). El sistema no sanciona solo.
 */
export function AccountabilityCard({ open, resolved, decide }: { open: AccountabilityRow[]; resolved: AccountabilityRow[]; decide?: (input: { id: string; decision: "sin_medida" | "llamado_atencion" | "reposicion" | "suspension"; note: string }) => Promise<ActionResult> }) {
  const router = useRouter();
  const [tab, setTab] = useState<"abiertas" | "resueltas">("abiertas");
  const [target, setTarget] = useState<AccountabilityRow | null>(null);
  const [decision, setDecision] = useState<"sin_medida" | "llamado_atencion" | "reposicion" | "suspension">("llamado_atencion");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  const rows = tab === "abiertas" ? open : resolved;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!target || !decide) return;
    setError(null);
    run(async () => {
      const result = await decide({ id: target.id, decision, note });
      if (!result.ok) return setError(result.error);
      setTarget(null);
      setNote("");
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Responsabilidades de efectivo"
        subtitle={decide ? "Cada falta queda a nombre de una persona. Decide la medida en 5 días hábiles." : "Cada falta queda a nombre de una persona. La administración decide la medida."}
        actions={
          <div role="tablist" aria-label="Estado" className="flex gap-1.5">
            {(["abiertas", "resueltas"] as const).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={pillStyles(tab === key)}>
                {key === "abiertas" ? `Abiertas (${open.length})` : "Resueltas"}
              </button>
            ))}
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={tab === "abiertas" ? "Nada por decidir" : "Sin decisiones todavía"}>{tab === "abiertas" ? "No hay faltas de efectivo abiertas." : "Aquí verás las medidas que tomó la administración."}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-tinta">{accountabilityLabels[row.kind] ?? row.kind}</span>
                  <Badge tone={row.responsible === "cajero" ? "neutral" : "warning"}>{row.responsible === "cajero" ? "Cajero" : "Repartidor"}</Badge>
                </span>
                <span className="block text-tinta">
                  {row.person} · {formatMoney(row.amount)}
                  {row.register ? ` · ${row.register}` : ""}
                  {row.orderNumber !== null ? ` · pedido ${row.orderNumber}` : ""}
                </span>
                <span className="block text-xs text-tinta-suave">
                  {row.createdAt} · {row.detail}
                </span>
                {row.status === "resuelta" ? (
                  <span className="mt-1 block text-xs text-tinta">
                    <span className="font-bold">{decisionLabels[row.decision ?? ""] ?? row.decision}</span> · {row.decisionNote} · {row.decidedAt}
                  </span>
                ) : null}
              </span>
              {row.status === "abierta" ? (
                <span className="flex flex-wrap items-center gap-2">
                  <SlaBadge kind="medida" from={row.createdIso} />
                  {decide ? (
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3"
                      onClick={() => {
                        setTarget(row);
                        setError(null);
                      }}
                    >
                      Decidir medida
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={target !== null} onClose={() => setTarget(null)} title="Decidir la medida">
        <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
          {target ? (
            <p className="text-sm text-tinta-suave">
              {accountabilityLabels[target.kind] ?? target.kind} de {target.person} por {formatMoney(target.amount)}. La decisión queda en la auditoría y no se cambia.
            </p>
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm font-bold text-tinta">
            Medida
            <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} className="min-h-11 rounded-campo border border-borde-campo bg-papel px-3 text-sm font-semibold text-tinta">
              {Object.entries(decisionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Motivo de la decisión" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} hint="Entre 5 y 300 caracteres" />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={busy || note.trim().length < 5}>
              {busy ? "Guardando…" : "Guardar decisión"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

/** Historial de entregas: quién, a qué caja, cuándo, lo declarado, lo contado y la diferencia. No se modifica. */
export function HandoffHistoryCard({ rows }: { rows: HandoffRow[] }) {
  const columns: Column<HandoffRow>[] = [
    {
      header: "Repartidor",
      cell: (row) => (
        <span className="block min-w-[9rem]">
          <span className="block font-bold text-tinta">{row.courier}</span>
          <span className="block text-xs text-tinta-suave">Pedidos {row.orders.join(", ")}</span>
        </span>
      ),
    },
    {
      header: "Caja",
      cell: (row) => (
        <span className="block min-w-[8rem]">
          <span className="block text-tinta">{row.register}</span>
          <span className="block text-xs text-tinta-suave">{row.cashier}</span>
        </span>
      ),
    },
    {
      header: "Enviada / resuelta",
      cell: (row) => (
        <span className="block whitespace-nowrap text-xs tabular-nums text-tinta-suave">
          {row.createdAt}
          <br />
          {row.resolvedAt ?? "—"}
        </span>
      ),
    },
    { header: "Declarado", cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatMoney(row.declared)}</span> },
    { header: "Contado", cell: (row) => <span className="whitespace-nowrap tabular-nums">{row.counted === null ? "—" : formatMoney(row.counted)}</span> },
    { header: "Diferencia", cell: (row) => <span className={cn("whitespace-nowrap font-bold tabular-nums", row.difference ? "text-rojo" : "text-tinta-suave")}>{row.difference === null ? "—" : formatMoney(row.difference)}</span> },
    {
      header: "Estado",
      className: "w-px whitespace-nowrap pr-4",
      cell: (row) => (
        <span title={row.note ?? undefined}>
          <Badge tone={handoffStatus[row.status]?.tone ?? "neutral"}>{handoffStatus[row.status]?.label ?? row.status}</Badge>
        </span>
      ),
    },
  ];
  return (
    <Card className="p-5">
      <CardHeader title="Entregas de efectivo" subtitle="Cada entrega del repartidor a una caja, con lo que declaró y lo que contó el cajero." />
      {rows.length === 0 ? <EmptyState title="Sin entregas todavía">Aparecen cuando un repartidor entrega efectivo en una caja.</EmptyState> : <DataTable caption="Entregas de efectivo" columns={columns} rows={rows} rowKey={(row) => row.id} emptyTitle="" />}
    </Card>
  );
}
