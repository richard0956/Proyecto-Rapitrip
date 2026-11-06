import "server-only";
import { formatDateTime } from "@/lib/format";
import type { serverSupabase } from "@/lib/supabase";

type Client = Awaited<ReturnType<typeof serverSupabase>>;

export type CustodyRow = { courierId: string; name: string; hasAccount: boolean; total: number; orders: number; oldest: string | null; pendingRegister: string | null; pendingExpiresAt: string | null; blocked: string | null };
export type CashPoint = { sessionId: string; label: string };
export type AccountabilityRow = { id: string; kind: string; responsible: "repartidor" | "cajero"; person: string; amount: number; detail: string; createdAt: string; createdIso: string; status: "abierta" | "resuelta"; decision: string | null; decisionNote: string | null; decidedAt: string | null; register: string | null; orderNumber: number | null };
export type HandoffRow = { id: string; status: string; courier: string; register: string; cashier: string; declared: number; counted: number | null; difference: number | null; note: string | null; orders: number[]; createdAt: string; resolvedAt: string | null };
export type CashSettings = { confirmMinutes: number; maxHoldHours: number; maxHoldAmount: number };

export type CashControl = { custody: CustodyRow[]; points: CashPoint[]; open: AccountabilityRow[]; resolved: AccountabilityRow[]; handoffs: HandoffRow[]; failed: boolean };

/** Lo que ven coordinación y administración del efectivo: a cargo de quién está, las entregas y las responsabilidades. */
export async function loadCashControl(supabase: Client): Promise<CashControl> {
  const [custody, points, open, resolved, handoffs] = await Promise.all([
    supabase.rpc("couriers_cash_overview"),
    supabase.rpc("open_cash_points"),
    supabase.rpc("cash_accountability_list", { p_status: "abierta" }),
    supabase.rpc("cash_accountability_list", { p_status: "resuelta" }),
    supabase.rpc("cash_handoffs_history", { p_limit: 60 }),
  ]);
  const errors = [custody, points, open, resolved, handoffs].flatMap((r) => (r.error ? [r.error.message] : []));
  if (errors.length > 0) console.error("[efectivo]", errors.join(" | "));

  const toAccountability = (row: NonNullable<typeof open.data>[number]): AccountabilityRow => ({
    id: row.id,
    kind: row.kind,
    responsible: row.responsible === "cajero" ? "cajero" : "repartidor",
    person: row.person_name ?? "",
    amount: Number(row.amount ?? 0),
    detail: row.detail,
    createdAt: formatDateTime(row.created_at),
    createdIso: row.created_at,
    status: row.status === "resuelta" ? "resuelta" : "abierta",
    decision: row.decision ?? null,
    decisionNote: row.decision_note ?? null,
    decidedAt: row.decided_at ? formatDateTime(row.decided_at) : null,
    register: row.register_name ?? null,
    orderNumber: row.order_number == null ? null : Number(row.order_number),
  });

  return {
    custody: (custody.data ?? []).map((row) => ({
      courierId: row.courier_id,
      name: row.full_name,
      hasAccount: Boolean(row.has_account),
      total: Number(row.custody_total ?? 0),
      orders: Number(row.custody_orders ?? 0),
      oldest: row.oldest_delivered_at ? formatDateTime(row.oldest_delivered_at) : null,
      pendingRegister: row.pending_register ?? null,
      pendingExpiresAt: row.pending_expires_at ?? null,
      blocked: row.blocked ?? null,
    })),
    points: (points.data ?? []).map((row) => ({ sessionId: row.session_id, label: `${row.register_name}${row.register_code ? ` · ${row.register_code}` : ""} · ${row.cashier_name}` })),
    open: (open.data ?? []).map(toAccountability),
    resolved: (resolved.data ?? []).map(toAccountability),
    handoffs: (handoffs.data ?? []).map((row) => ({
      id: row.handoff_id,
      status: row.status,
      courier: row.courier_name,
      register: row.register_name,
      cashier: row.cashier_name,
      declared: Number(row.declared ?? 0),
      counted: row.counted == null ? null : Number(row.counted),
      difference: row.difference == null ? null : Number(row.difference),
      note: row.note ?? null,
      orders: (row.order_numbers ?? []).map(Number),
      createdAt: formatDateTime(row.created_at),
      resolvedAt: row.resolved_at ? formatDateTime(row.resolved_at) : null,
    })),
    failed: errors.length > 0,
  };
}

export type RegisterRow = { id: string; name: string; code: string; active: boolean; cashierId: string | null; cashierName: string | null; openBy: string | null; openedAt: string | null; lastCounted: number | null };
export type CashierOption = { id: string; name: string };

/** Solo administración: cajas físicas, cajeros para asignarlas y los límites de efectivo. */
export async function loadCashAdmin(supabase: Client): Promise<{ registers: RegisterRow[]; cashiers: CashierOption[]; settings: CashSettings; failed: boolean }> {
  const [registers, cashiers, settings] = await Promise.all([
    supabase.rpc("cash_registers_admin"),
    supabase.from("accounts_staff").select("user_id, full_name, role_status").eq("role", "cajero"),
    supabase.rpc("cash_settings"),
  ]);
  const errors = [registers, cashiers, settings].flatMap((r) => (r.error ? [r.error.message] : []));
  if (errors.length > 0) console.error("[efectivo:admin]", errors.join(" | "));
  const s = (settings.data ?? {}) as Record<string, number>;
  return {
    registers: (registers.data ?? []).map((row) => ({
      id: row.register_id,
      name: row.name,
      code: row.code,
      active: row.active,
      cashierId: row.cashier_id ?? null,
      cashierName: row.cashier_name ?? null,
      openBy: row.open_session ? (row.open_cashier_name ?? "Cajero") : null,
      openedAt: row.opened_at ? formatDateTime(row.opened_at) : null,
      lastCounted: row.last_counted == null ? null : Number(row.last_counted),
    })),
    cashiers: (cashiers.data ?? []).flatMap((row) => (row.user_id && row.role_status === "activo" ? [{ id: row.user_id, name: row.full_name ?? "Cajero" }] : [])),
    settings: { confirmMinutes: Number(s.confirm_minutes ?? 15), maxHoldHours: Number(s.max_hold_hours ?? 4), maxHoldAmount: Number(s.max_hold_amount ?? 5000) },
    failed: errors.length > 0,
  };
}
