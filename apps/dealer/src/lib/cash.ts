/** El efectivo del repartidor, tal como lo devuelve `courier_cash_status`. */
export type CashOrder = { orderId: string; number: number; store: string; amount: number; deliveredAt: string; inHandoff: boolean };
export type CashPending = { id: string; register: string; declared: number; createdAt: string; expiresAt: string };
export type CashLast = { id: string; status: "confirmada" | "con_diferencia" | "rechazada" | "vencida"; register: string; declared: number; counted: number | null; difference: number | null; note: string | null; resolvedAt: string | null };
export type CashStatus = {
  total: number;
  orders: CashOrder[];
  pending: CashPending | null;
  last: CashLast | null;
  block: string | null;
  confirmMinutes: number;
  maxHoldHours: number;
  maxHoldAmount: number;
  openItems: number;
};

const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const str = (value: unknown) => (typeof value === "string" ? value : "");
const record = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const lastStatuses = ["confirmada", "con_diferencia", "rechazada", "vencida"] as const;

/** Lee la respuesta sin confiar en su forma: lo que no se entiende queda vacío. */
export function parseCashStatus(value: unknown): CashStatus {
  const data = record(value) ?? {};
  const pending = record(data.pending);
  const last = record(data.last);
  const status = lastStatuses.find((item) => item === last?.status);
  return {
    total: num(data.custody_total),
    orders: (Array.isArray(data.orders) ? data.orders : []).flatMap((entry) => {
      const row = record(entry);
      return row && typeof row.order_id === "string"
        ? [{ orderId: row.order_id, number: num(row.number), store: str(row.store_name), amount: num(row.amount), deliveredAt: str(row.delivered_at), inHandoff: row.in_handoff === true }]
        : [];
    }),
    pending: pending && typeof pending.id === "string" ? { id: pending.id, register: str(pending.register_name), declared: num(pending.declared), createdAt: str(pending.created_at), expiresAt: str(pending.expires_at) } : null,
    last:
      last && typeof last.id === "string" && status
        ? { id: last.id, status, register: str(last.register_name), declared: num(last.declared), counted: last.counted == null ? null : num(last.counted), difference: last.difference == null ? null : num(last.difference), note: typeof last.note === "string" ? last.note : null, resolvedAt: typeof last.resolved_at === "string" ? last.resolved_at : null }
        : null,
    block: typeof data.block === "string" && data.block ? data.block : null,
    confirmMinutes: num(data.confirm_minutes, 15),
    maxHoldHours: num(data.max_hold_hours, 4),
    maxHoldAmount: num(data.max_hold_amount, 5000),
    openItems: num(data.open_items),
  };
}

/** Qué le decimos al repartidor del último resultado de su entrega. */
export function lastMessage(last: CashLast): { tone: "info" | "warning" | "error"; text: string } {
  switch (last.status) {
    case "confirmada":
      return { tone: "info", text: `${last.register} confirmó tu entrega: el monto cuadró.` };
    case "con_diferencia": {
      const diff = last.difference ?? 0;
      return diff < 0
        ? { tone: "warning", text: `${last.register} contó C$ ${Math.abs(diff).toFixed(2)} menos de lo que cobraste. Esa diferencia queda a tu cargo.` }
        : { tone: "warning", text: `${last.register} contó C$ ${diff.toFixed(2)} más de lo que cobraste. Administración lo revisará.` };
    }
    case "rechazada":
      return { tone: "error", text: `${last.register} rechazó la entrega${last.note ? `: «${last.note}»` : ""}. El efectivo sigue a tu cargo; coordinación revisará el caso.` };
    case "vencida":
      return { tone: "error", text: `El cajero de ${last.register} no confirmó a tiempo. El efectivo sigue a tu cargo: vuelve a enviarlo cuando estés frente a la caja.` };
  }
}
