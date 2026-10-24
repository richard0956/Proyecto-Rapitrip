import { cashDifference } from "./order-trace";

type CashRow = { total: number; collected: number | null; code: string | null; received: boolean };

export type CashStatus = { kind: "recibido" | "pendiente_caja" | "sin_registrar"; difference: number | null };

/** Dónde está el efectivo de una entrega: ya en caja, cobrado y por rendir, o sin registrar todavía. */
export function cashStatus(row: CashRow): CashStatus {
  const difference = cashDifference({ method: "efectivo", total: row.total, collected: row.collected, code: row.code, receivedAt: row.received ? "x" : null });
  if (row.received) return { kind: "recibido", difference };
  return { kind: row.code ? "pendiente_caja" : "sin_registrar", difference };
}

export type CashSummary = { pending: number; pendingOrders: number; received: number; receivedOrders: number; difference: number; differences: number };

/** Lo que falta por rendir, lo que caja ya recibió y cuánto se desvía lo cobrado de lo debido. */
export function summarizeCash(rows: CashRow[]): CashSummary {
  const out: CashSummary = { pending: 0, pendingOrders: 0, received: 0, receivedOrders: 0, difference: 0, differences: 0 };
  for (const row of rows) {
    const status = cashStatus(row);
    const amount = row.collected ?? row.total;
    if (status.kind === "recibido") {
      out.received += amount;
      out.receivedOrders++;
    } else if (status.kind === "pendiente_caja") {
      out.pending += amount;
      out.pendingOrders++;
    }
    if (status.difference !== null && status.difference !== 0) {
      out.difference = Math.round((out.difference + status.difference) * 100) / 100;
      out.differences++;
    }
  }
  out.pending = Math.round(out.pending * 100) / 100;
  out.received = Math.round(out.received * 100) / 100;
  return out;
}
