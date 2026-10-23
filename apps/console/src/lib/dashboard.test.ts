import { describe, expect, it } from "vitest";
import { compactMoney, delta, fillDays, firstDays, minutesUntil, parsePeriod, periodOptions, projectMonthEnd, trendOf } from "./dashboard";

const now = new Date("2026-10-22T20:00:00Z");

describe("periodos del dashboard", () => {
  it("hoy: el día local de Costa Rica (UTC−6)", () => {
    const p = parsePeriod("hoy", now);
    expect(p.from).toBe("2026-10-22T06:00:00.000Z");
    expect(p.to).toBe("2026-10-23T06:00:00.000Z");
    expect(p.prevFrom).toBe("2026-10-21T06:00:00.000Z");
    expect(p.prevTo).toBe("2026-10-22T06:00:00.000Z");
    expect(p.days).toBe(1);
  });

  it("7 días: los últimos siete días incluido hoy, contra los siete anteriores", () => {
    const p = parsePeriod("7d", now);
    expect(p.from).toBe("2026-10-16T06:00:00.000Z");
    expect(p.to).toBe("2026-10-23T06:00:00.000Z");
    expect(p.prevFrom).toBe("2026-10-09T06:00:00.000Z");
    expect(p.prevTo).toBe("2026-10-16T06:00:00.000Z");
    expect(p.days).toBe(7);
  });

  it("mes: el mes de calendario contra el mes anterior", () => {
    const p = parsePeriod("mes", now);
    expect(p.from).toBe("2026-10-01T06:00:00.000Z");
    expect(p.to).toBe("2026-11-01T06:00:00.000Z");
    expect(p.prevFrom).toBe("2026-09-01T06:00:00.000Z");
    expect(p.prevTo).toBe("2026-10-01T06:00:00.000Z");
    expect(p.days).toBe(31);
  });

  it("quincena: segunda mitad (16 al fin) y primera mitad (1 al 15)", () => {
    const second = parsePeriod("quincena", now);
    expect(second.from).toBe("2026-10-16T06:00:00.000Z");
    expect(second.to).toBe("2026-11-01T06:00:00.000Z");
    expect(second.prevFrom).toBe("2026-10-01T06:00:00.000Z");
    expect(second.prevTo).toBe("2026-10-16T06:00:00.000Z");
    const first = parsePeriod("quincena", new Date("2026-10-10T20:00:00Z"));
    expect(first.from).toBe("2026-10-01T06:00:00.000Z");
    expect(first.to).toBe("2026-10-16T06:00:00.000Z");
    expect(first.prevFrom).toBe("2026-09-16T06:00:00.000Z");
    expect(first.prevTo).toBe("2026-10-01T06:00:00.000Z");
  });

  it("cerca de la medianoche usa el día de Costa Rica, no el de UTC", () => {
    const p = parsePeriod("hoy", new Date("2026-10-23T03:00:00Z"));
    expect(p.from).toBe("2026-10-22T06:00:00.000Z");
  });

  it("un valor inválido o ausente usa el mes", () => {
    expect(parsePeriod("xyz", now).key).toBe("mes");
    expect(parsePeriod(undefined, now).key).toBe("mes");
    expect(periodOptions.map((o) => o.key)).toEqual(["hoy", "7d", "quincena", "mes"]);
  });
});

describe("cálculos del dashboard", () => {
  it("delta compara con el periodo anterior y no divide entre cero", () => {
    expect(delta(110, 100)).toEqual({ pct: 10, direction: "up" });
    expect(delta(90, 100)).toEqual({ pct: -10, direction: "down" });
    expect(delta(100, 100)).toEqual({ pct: 0, direction: "flat" });
    expect(delta(5, 0)).toEqual({ pct: null, direction: "up" });
    expect(delta(0, 0)).toEqual({ pct: null, direction: "flat" });
  });

  it("proyecta el fin de mes con el promedio diario", () => {
    expect(projectMonthEnd(67_400, now)).toBe((67_400 / 22) * 31);
    expect(projectMonthEnd(0, new Date("2026-10-01T20:00:00Z"))).toBe(0);
    expect(projectMonthEnd(500, new Date("2026-02-01T20:00:00Z"))).toBe(500 * 28);
  });

  it("rellena con cero los días sin datos", () => {
    const filled = fillDays([{ day: "2026-10-02", value: 7 }], "2026-10-01T06:00:00.000Z", "2026-10-04T06:00:00.000Z");
    expect(filled).toEqual([
      { day: "2026-10-01", value: 0 },
      { day: "2026-10-02", value: 7 },
      { day: "2026-10-03", value: 0 },
    ]);
  });

  it("abrevia el dinero para los ejes de los gráficos", () => {
    expect(compactMoney(0)).toBe("C$ 0");
    expect(compactMoney(1500)).toMatch(/^C\$ 1[,.]5/);
    expect(compactMoney(1500).length).toBeLessThan(12);
  });

  it("cuenta los minutos que faltan para un plazo, sin bajar de cero", () => {
    expect(minutesUntil("2026-10-22T20:09:00Z", now)).toBe(9);
    expect(minutesUntil("2026-10-22T20:08:10Z", now)).toBe(9);
    expect(minutesUntil("2026-10-22T19:00:00Z", now)).toBe(0);
    expect(minutesUntil(null, now)).toBeNull();
  });

  it("firstDays deja solo los primeros N días del periodo anterior para comparar lo equivalente", () => {
    const rows = [{ day: "2026-09-01", value: 5 }, { day: "2026-09-02", value: 7 }, { day: "2026-09-03", value: 9 }];
    expect(firstDays(rows, "2026-09-01T06:00:00.000Z", 2).map((row) => row.value)).toEqual([5, 7]);
    expect(firstDays(rows, "2026-09-01T06:00:00.000Z", 0)).toEqual([]);
    expect(firstDays(rows, "2026-09-01T06:00:00.000Z", 31)).toHaveLength(3);
  });

  it("trendOf escribe la variación o dice que no hay con qué comparar", () => {
    expect(trendOf(110, 100, "el mes anterior")).toEqual({ direction: "up", text: "▲ 10 % vs el mes anterior" });
    expect(trendOf(90, 100, "ayer")).toEqual({ direction: "down", text: "▼ 10 % vs ayer" });
    expect(trendOf(100, 100, "ayer")).toEqual({ direction: "flat", text: "= 0 % vs ayer" });
    expect(trendOf(5, 0, "el mes anterior")).toEqual({ direction: "flat", text: "Sin comparación con el mes anterior" });
  });
});
