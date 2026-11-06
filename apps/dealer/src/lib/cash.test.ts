import { describe, expect, it } from "vitest";
import { lastMessage, parseCashStatus } from "./cash";

describe("parseCashStatus", () => {
  it("lee el efectivo, la entrega pendiente y los límites", () => {
    const status = parseCashStatus({
      custody_total: "400.00",
      orders: [{ order_id: "o1", number: 1201, store_name: "Café Central", amount: 200, delivered_at: "2026-11-05T14:00:00Z", in_handoff: true }, { nope: true }],
      pending: { id: "h1", register_name: "Caja 1", declared: 400, created_at: "2026-11-05T15:00:00Z", expires_at: "2026-11-05T15:15:00Z" },
      last: null,
      block: null,
      confirm_minutes: 15,
      max_hold_hours: 4,
      max_hold_amount: 5000,
      open_items: 1,
    });
    expect(status.total).toBe(400);
    expect(status.orders).toEqual([{ orderId: "o1", number: 1201, store: "Café Central", amount: 200, deliveredAt: "2026-11-05T14:00:00Z", inHandoff: true }]);
    expect(status.pending?.register).toBe("Caja 1");
    expect(status.openItems).toBe(1);
  });

  it("con datos raros queda vacío en vez de romper", () => {
    const status = parseCashStatus("x");
    expect(status).toMatchObject({ total: 0, orders: [], pending: null, last: null, block: null, confirmMinutes: 15 });
  });
});

describe("lastMessage", () => {
  const base = { id: "h", register: "Caja 1", declared: 400, counted: 350, note: null, resolvedAt: null };
  it("explica un faltante como responsabilidad del repartidor", () => {
    expect(lastMessage({ ...base, status: "con_diferencia", difference: -50 })).toEqual({ tone: "warning", text: expect.stringContaining("C$ 50.00 menos") });
  });
  it("un rechazo o un vencimiento dejan el efectivo a su cargo", () => {
    expect(lastMessage({ ...base, status: "rechazada", difference: null, note: "no llegó" }).text).toContain("sigue a tu cargo");
    expect(lastMessage({ ...base, status: "vencida", difference: null }).tone).toBe("error");
  });
});
