import { describe, expect, it } from "vitest";
import { flattenHours, groupHours, storeLocalToIso, storeState } from "./stores";

describe("horarios de tienda", () => {
  it("agrupa por día y ordena los tramos", () => {
    const grouped = groupHours([
      { weekday: 1, opens: "13:00", closes: "18:00" },
      { weekday: 1, opens: "08:00", closes: "12:00" },
      { weekday: 0, opens: "09:00", closes: "13:00" },
      { weekday: null, opens: "09:00", closes: "13:00" },
    ]);
    expect(grouped[1]).toEqual([{ opens: "08:00", closes: "12:00" }, { opens: "13:00", closes: "18:00" }]);
    expect(Object.keys(grouped).sort()).toEqual(["0", "1"]);
  });

  it("aplana de vuelta al formato de la base de datos", () => {
    expect(flattenHours({ 2: [{ opens: "08:00", closes: "12:00" }] })).toEqual([{ weekday: 2, opens: "08:00", closes: "12:00" }]);
  });

  it("interpreta la fecha local como hora de Costa Rica (UTC−6)", () => {
    expect(storeLocalToIso("2026-10-20T08:00")).toBe("2026-10-20T14:00:00.000Z");
  });
});

describe("estado de la tienda", () => {
  it("prioriza inactiva y cierre temporal sobre el horario", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(storeState({ status: "inactiva", closed_until: null, open_now: true }).label).toBe("Inactiva");
    expect(storeState({ status: "activa", closed_until: future, open_now: false }).label).toBe("Cerrada temporalmente");
    expect(storeState({ status: "activa", closed_until: null, open_now: true }).label).toBe("Abierta ahora");
    expect(storeState({ status: "activa", closed_until: null, open_now: false }).label).toBe("Cerrada por horario");
  });
});
