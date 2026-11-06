import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { first, type SearchParams } from "@/lib/filters";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { recordReconciliation, recordSettlement, saveAgreement } from "./actions";
import { SettlementsWorkspace, type CommerceSettlement, type ReconciliationRow, type ReconciliationSummary, type SettlementRow } from "./settlements-workspace";

export const metadata = { title: "Liquidaciones" };

const monthName = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "America/Managua" });
/** El mes actual y los cinco anteriores, en hora de Managua. */
function lastMonths(count = 6) {
  const now = new Date(Date.now() - 6 * 3_600_000);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15));
    return { value: d.toISOString().slice(0, 7), label: monthName.format(d) };
  });
}

/** Liquidaciones a comercios (Política 9 del manual de políticas de TI): pendientes por comercio, historial y conciliación mensual. */
export default async function LiquidacionesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireConsoleAccess("admin");
  const params = await searchParams;
  const months = lastMonths();
  const month = months.find((m) => m.value === first(params.mes))?.value ?? months[0]!.value;
  const supabase = await serverSupabase();
  const [overview, history, summary, reconciliations] = await Promise.all([
    supabase.rpc("settlements_overview"),
    supabase.rpc("settlements_history", {}),
    supabase.rpc("reconciliation_summary", { p_month: `${month}-01` }),
    supabase.rpc("reconciliations"),
  ]);
  const errors = [overview, history, summary, reconciliations].flatMap((r) => (r.error ? [r.error.message] : []));
  if (errors.length > 0) console.error("[liquidaciones]", errors.join(" | "));

  const commerces: CommerceSettlement[] = (overview.data ?? []).map((r) => ({
    commerceId: r.commerce_id,
    name: r.commerce_name,
    pendingOrders: r.pending_orders,
    pendingAmount: Number(r.pending_amount),
    pendingReversals: Number(r.pending_reversals),
    commissionPct: Number(r.commission_pct),
    periodDays: r.period_days,
    bearer: r.return_cost_bearer === "rapitrip" ? "rapitrip" : "comercio",
    lastSettledAt: r.last_settled_at ? formatDateTime(r.last_settled_at) : null,
    dueIso: r.due_at,
  }));
  const rows: SettlementRow[] = (history.data ?? []).map((r) => ({ id: r.id, number: r.number, commerce: r.commerce_name, orders: r.orders_count, gross: Number(r.gross), commission: Number(r.commission), reversals: Number(r.reversals), net: Number(r.net), reference: r.reference, createdAt: formatDateTime(r.created_at) }));
  const s = (summary.data ?? {}) as Record<string, number | string | null>;
  const recon: ReconciliationSummary = {
    month,
    charged: Number(s.charged ?? 0),
    chargedOrders: Number(s.charged_orders ?? 0),
    settled: Number(s.settled ?? 0),
    commission: Number(s.commission ?? 0),
    reversed: Number(s.reversed ?? 0),
    netPaid: Number(s.net_paid ?? 0),
    overdueUnsettled: Number(s.overdue_unsettled ?? 0),
    pendingReversals: Number(s.pending_reversals ?? 0),
    mismatched: Number(s.mismatched_items ?? 0),
    lastReconciledAt: s.last_reconciled_at ? formatDateTime(String(s.last_reconciled_at)) : null,
  };
  const reconRows: ReconciliationRow[] = (reconciliations.data ?? []).map((r) => ({ id: r.id, month: monthName.format(new Date(`${r.month}T12:00:00Z`)), doneAt: formatDateTime(r.done_at), doneBy: r.done_by_name ?? "Administración", differences: r.differences, corrections: r.corrections }));
  const view = first(params.vista);

  return (
    <>
      <PageHeader title="Liquidaciones" description="Lo que Rapitrip le paga a cada comercio por sus pedidos, las reversiones por devoluciones y la conciliación de cada mes (Política 9)." />
      {errors.length > 0 ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <SettlementsWorkspace
        initialTab={view === "conciliacion" ? "conciliacion" : view === "historial" ? "historial" : "pendientes"}
        commerces={commerces}
        history={rows}
        summary={recon}
        reconciliations={reconRows}
        months={months}
        actions={{ saveAgreement, recordSettlement, recordReconciliation }}
      />
    </>
  );
}
