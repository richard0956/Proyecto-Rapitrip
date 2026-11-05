import { describe, expect, it } from "vitest";
import { addBusinessDays, incidentSlaKind, isOverdue, slaDeadline, slaState } from "./sla";

// Hora de Managua = UTC−6. El 4 de noviembre de 2026 es miércoles.
const managua = (iso: string) => new Date(`${iso}-06:00`);

describe("plazos del manual de políticas de TI", () => {
  it("los días hábiles saltan sábado y domingo, en hora de Managua", () => {
    expect(addBusinessDays(managua("2026-11-04T10:00:00"), 3)).toEqual(managua("2026-11-09T10:00:00")); // miércoles → lunes
    expect(addBusinessDays(managua("2026-11-06T18:30:00"), 1)).toEqual(managua("2026-11-09T18:30:00")); // viernes → lunes
    expect(addBusinessDays(managua("2026-11-07T09:00:00"), 3)).toEqual(managua("2026-11-11T09:00:00")); // sábado → miércoles
  });

  it("cada plazo usa su regla", () => {
    const from = managua("2026-11-04T10:00:00");
    expect(slaDeadline("incidencia", from)).toEqual(managua("2026-11-04T10:30:00"));
    expect(slaDeadline("errorGrave", from)).toEqual(managua("2026-11-04T14:00:00"));
    expect(slaDeadline("eliminacion", from)).toEqual(managua("2026-12-04T10:00:00"));
    expect(slaDeadline("devolucion", from)).toEqual(managua("2026-11-09T10:00:00"));
  });

  it("dice si va a tiempo, si está por vencer o cuánto hace que venció", () => {
    const from = managua("2026-11-04T10:00:00");
    expect(slaState("incidencia", from, managua("2026-11-04T10:05:00"))).toEqual({ tone: "positive", text: "Vence en 25 min", overdue: false });
    expect(slaState("incidencia", from, managua("2026-11-04T10:25:00"))).toMatchObject({ tone: "warning", text: "Vence en 5 min" });
    expect(slaState("errorGrave", from, managua("2026-11-04T16:00:00"))).toEqual({ tone: "danger", text: "Vencido hace 2 h", overdue: true });
    expect(isOverdue("eliminacion", from, managua("2026-12-10T10:00:00"))).toBe(true);
  });

  it("los incidentes de seguridad no tienen plazo de corrección; las fallas sí, según su gravedad", () => {
    expect(incidentSlaKind("seguridad", "alta")).toBeNull();
    expect(incidentSlaKind("interrupcion", "alta")).toBe("errorGrave");
    expect(incidentSlaKind("interrupcion", "media")).toBe("errorLeve");
  });
});
