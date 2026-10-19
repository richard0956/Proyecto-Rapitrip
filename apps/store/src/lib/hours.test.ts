import { describe, expect, it } from "vitest";
import { hoursRows } from "./hours";

describe("hoursRows", () => {
  it("ordena de lunes a domingo, junta los tramos de un día y marca los cerrados", () => {
    const rows = hoursRows([
      { weekday: 0, opens: "09:00", closes: "13:00" },
      { weekday: 1, opens: "14:00", closes: "18:00" },
      { weekday: 1, opens: "08:00", closes: "12:00" },
    ]);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ day: "Lunes", text: "08:00–12:00, 14:00–18:00" });
    expect(rows[1]).toEqual({ day: "Martes", text: "Cerrado" });
    expect(rows[6]).toEqual({ day: "Domingo", text: "09:00–13:00" });
  });
});
