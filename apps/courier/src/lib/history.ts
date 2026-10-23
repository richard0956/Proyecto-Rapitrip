import type { CourierHistoryRow } from "./types";

export type HistorySummary = { deliveries: number; km: number; cashPending: number; cashPendingOrders: number };

/** Totales del periodo y el efectivo que el repartidor aún no rindió en caja (cobrado, pero el cajero no lo recibió). */
export function summarize(rows: CourierHistoryRow[]): HistorySummary {
  let km = 0;
  let cashPending = 0;
  let cashPendingOrders = 0;
  for (const row of rows) {
    km += Number(row.distance_km ?? 0);
    if (row.payment_method === "efectivo" && !row.cash_received) {
      cashPending += Number(row.cash_total ?? 0);
      cashPendingOrders++;
    }
  }
  return { deliveries: rows.length, km: Math.round(km * 10) / 10, cashPending, cashPendingOrders };
}
