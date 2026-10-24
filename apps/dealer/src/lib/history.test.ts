import { describe, expect, it } from "vitest";
import { summarize } from "./history";
import type { CourierHistoryRow } from "./types";

const row = (over: Partial<CourierHistoryRow>): CourierHistoryRow => ({
  order_id: "o", number: 1, store_name: "T", delivery_class: "express", delivered_at: "2026-10-23T12:00:00Z", distance_km: 2, payment_method: "tarjeta",
  cash_total: null as unknown as number, cash_registered: false, cash_received: false, ...over,
});

describe("summarize", () => {
  it("suma entregas y kilómetros", () => {
    expect(summarize([row({ distance_km: 2.5 }), row({ distance_km: 3.3 })])).toMatchObject({ deliveries: 2, km: 5.8 });
  });
  it("solo cuenta como por rendir el efectivo que caja aún no recibió", () => {
    const result = summarize([
      row({ payment_method: "efectivo", cash_total: 350, cash_received: false }),
      row({ payment_method: "efectivo", cash_total: 100, cash_received: true }),
      row({ payment_method: "tarjeta" }),
    ]);
    expect(result).toMatchObject({ cashPending: 350, cashPendingOrders: 1 });
  });
  it("sin entregas todo es cero", () => {
    expect(summarize([])).toEqual({ deliveries: 0, km: 0, cashPending: 0, cashPendingOrders: 0 });
  });
});
