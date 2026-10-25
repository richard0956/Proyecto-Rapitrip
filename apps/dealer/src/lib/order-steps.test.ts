import { describe, expect, it } from "vitest";
import { canRelease, canReportNoFit, isOpen, stageIndex, stepFor, type StepKey } from "./order-steps";

describe("stepFor", () => {
  it("dice qué toca en cada estado", () => {
    expect(stepFor("confirmado").key).toBe("esperar");
    expect(stepFor("preparando").key).toBe("esperar");
    expect(stepFor("listo").key).toBe("recoger");
    expect(stepFor("en_camino").key).toBe("entregar");
    expect(stepFor("entregado").key).toBe("entregado");
  });
  it("un estado desconocido o nulo es un pedido cerrado", () => {
    expect(stepFor("cancelado").key).toBe("cerrado");
    expect(stepFor(null).key).toBe("cerrado");
  });
});

describe("reglas de las acciones", () => {
  it("un pedido está abierto hasta que se entrega", () => {
    expect(["confirmado", "preparando", "listo", "en_camino"].every(isOpen)).toBe(true);
    expect(isOpen("entregado")).toBe(false);
    expect(isOpen(undefined)).toBe(false);
  });
  it("«no cabe» solo antes de recoger y solo en express", () => {
    expect(canReportNoFit("listo", "express")).toBe(true);
    expect(canReportNoFit("confirmado", "express")).toBe(true);
    expect(canReportNoFit("en_camino", "express")).toBe(false);
    expect(canReportNoFit("listo", "programado")).toBe(false);
  });
  it("devolver solo antes de recoger", () => {
    expect(canRelease("listo")).toBe(true);
    expect(canRelease("en_camino")).toBe(false);
    expect(canRelease("entregado")).toBe(false);
  });
});

describe("stageIndex", () => {
  it("ubica cada paso en la línea de ruta y deja fuera al pedido cerrado", () => {
    expect(["esperar", "recoger", "entregar", "entregado", "cerrado"].map((key) => stageIndex(key as StepKey))).toEqual([0, 1, 2, 3, -1]);
  });
});
