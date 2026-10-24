import { describe, expect, it } from "vitest";
import { cashStatus, summarizeCash } from "./courier-cash";

const row = (over: Partial<Parameters<typeof cashStatus>[0]>) => ({ total: 350, collected: 350, code: "CE-1", received: false, ...over });

describe("cashStatus", () => {
  it("distingue recibido, pendiente de caja y sin registrar", () => {
    expect(cashStatus(row({ received: true })).kind).toBe("recibido");
    expect(cashStatus(row({})).kind).toBe("pendiente_caja");
    expect(cashStatus(row({ code: null, collected: null })).kind).toBe("sin_registrar");
  });
  it("calcula la diferencia solo si hay un monto cobrado", () => {
    expect(cashStatus(row({ collected: 330 })).difference).toBe(-20);
    expect(cashStatus(row({ collected: null, code: null })).difference).toBeNull();
  });
});

describe("summarizeCash", () => {
  it("suma lo pendiente, lo recibido y las diferencias", () => {
    const summary = summarizeCash([
      row({ collected: 330 }),
      row({ received: true, collected: 350 }),
      row({ code: null, collected: null }),
      row({ collected: 370, total: 350 }),
    ]);
    expect(summary).toEqual({ pending: 700, pendingOrders: 2, received: 350, receivedOrders: 1, difference: 0, differences: 2 });
  });
  it("sin entregas todo es cero", () => {
    expect(summarizeCash([])).toEqual({ pending: 0, pendingOrders: 0, received: 0, receivedOrders: 0, difference: 0, differences: 0 });
  });
});
