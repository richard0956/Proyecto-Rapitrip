import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "./money";

describe("formatMoney", () => {
  it("da dos decimales en córdobas", () => {
    expect(formatMoney(350)).toBe("C$ 350.00");
    expect(formatMoney("12.5")).toBe("C$ 12.50");
  });
  it("devuelve un guion si no es un número", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney("abc")).toBe("—");
  });
});

describe("parseMoney", () => {
  it("lee lo que escribe el repartidor", () => {
    expect(parseMoney("350")).toBe(350);
    expect(parseMoney("350,50")).toBe(350.5);
    expect(parseMoney(" C$ 350.5 ")).toBe(350.5);
    expect(parseMoney("0")).toBe(0);
  });
  it("rechaza lo que no es un monto", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("1,2,3")).toBeNull();
  });
});
