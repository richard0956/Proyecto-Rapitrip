import { describe, expect, it } from "vitest";
import { dayEndExclusive, dayStart, first, optionalCursor, optionalDay, optionalUuid, queryString, realDay } from "./filters";

describe("filtros de la URL", () => {
  it("convierte un día en un rango [inicio, día siguiente)", () => {
    expect(dayStart("2026-10-17")).toBe("2026-10-17T00:00:00.000Z");
    expect(dayEndExclusive("2026-10-31")).toBe("2026-11-01T00:00:00.000Z");
    expect(dayEndExclusive("2026-12-31")).toBe("2027-01-01T00:00:00.000Z");
    expect(dayStart(undefined)).toBeUndefined();
  });

  it("descarta valores inválidos en lugar de fallar", () => {
    expect(optionalDay.parse("ayer")).toBeUndefined();
    expect(optionalDay.parse("2026-10-17")).toBe("2026-10-17");
    expect(optionalUuid.parse("no-es-uuid")).toBeUndefined();
    expect(optionalCursor.parse("-5")).toBeUndefined();
    expect(optionalCursor.parse("42")).toBe(42);
    expect(optionalCursor.parse(undefined)).toBeUndefined();
  });

  it("arma la query omitiendo vacíos", () => {
    expect(queryString({ a: "x", b: undefined, c: "", d: 3 })).toBe("?a=x&d=3");
    expect(queryString({})).toBe("");
  });

  it("toma el primer valor si el parámetro se repite", () => {
    expect(first(["a", "b"])).toBe("a");
    expect(first("a")).toBe("a");
  });

  it("realDay descarta fechas con formato válido pero imposibles", () => {
    expect(realDay("2026-10-17")).toBe("2026-10-17");
    expect(realDay("2026-02-29")).toBeUndefined();
    expect(realDay("2026-13-45")).toBeUndefined();
    expect(realDay("ayer")).toBeUndefined();
    expect(realDay(undefined)).toBeUndefined();
  });
});
