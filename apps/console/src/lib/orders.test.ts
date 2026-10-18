import { describe, expect, it } from "vitest";
import { classifyExceptions, coordActions, coordTab, orderGroup, paymentLabel, shopActions, startOfTodayIso } from "./orders";

describe("pedidos del comercio", () => {
  it("agrupa los estados en las tres pestañas", () => {
    expect(orderGroup("por_confirmar")).toBe("confirmar");
    expect(orderGroup("pendiente_pago")).toBe("curso");
    expect(orderGroup("preparando")).toBe("curso");
    expect(orderGroup("entregado")).toBe("terminados");
    expect(orderGroup("rechazado")).toBe("terminados");
  });

  it("ofrece al comercio solo los pasos que le tocan", () => {
    expect(shopActions("por_confirmar").map((a) => a.to)).toEqual(["confirmado", "rechazado"]);
    expect(shopActions("por_confirmar").find((a) => a.to === "rechazado")?.reason).toBe(true);
    expect(shopActions("confirmado").map((a) => a.to)).toEqual(["preparando", "cancelado"]);
    expect(shopActions("preparando").map((a) => a.to)).toEqual(["listo", "cancelado"]);
    for (const status of ["pendiente_pago", "listo", "en_camino", "entregado", "cancelado", "rechazado"] as const) expect(shopActions(status)).toEqual([]);
  });

  it("describe el pago", () => {
    expect(paymentLabel("tarjeta", "pagado")).toBe("Tarjeta · pagada");
    expect(paymentLabel("tarjeta", "pendiente")).toBe("Tarjeta · sin pagar");
    expect(paymentLabel("tarjeta", "reembolsado")).toBe("Tarjeta · reembolsada");
    expect(paymentLabel("efectivo", "pendiente")).toBe("Efectivo contra entrega");
  });

  it("el día empieza a las 00:00 de Nicaragua (06:00 UTC)", () => {
    expect(startOfTodayIso(new Date("2026-10-18T15:30:00Z"))).toBe("2026-10-18T06:00:00.000Z");
    // A las 03:00 UTC todavía es el día anterior en Nicaragua (21:00).
    expect(startOfTodayIso(new Date("2026-10-18T03:00:00Z"))).toBe("2026-10-17T06:00:00.000Z");
  });
});

describe("coordinación", () => {
  it("reparte los estados en las pestañas", () => {
    expect(coordTab("listo")).toBe("listos");
    expect(coordTab("en_camino")).toBe("camino");
    expect(coordTab("confirmado")).toBe("preparacion");
    expect(coordTab("preparando")).toBe("preparacion");
    expect(coordTab("por_confirmar")).toBe("espera");
    expect(coordTab("pendiente_pago")).toBe("espera");
    expect(coordTab("entregado")).toBe("terminados");
    expect(coordTab("cancelado")).toBe("terminados");
  });

  it("despachar exige repartidor y cancelar exige motivo", () => {
    const listo = coordActions("listo");
    expect(listo.map((a) => a.to)).toEqual(["en_camino", "cancelado"]);
    expect(listo[0]?.needsCourier).toBe(true);
    expect(listo[1]?.reason).toBe(true);
    expect(coordActions("en_camino").map((a) => a.to)).toEqual(["entregado", "cancelado"]);
    expect(coordActions("preparando").map((a) => a.to)).toEqual(["cancelado"]);
    for (const status of ["entregado", "cancelado", "rechazado"] as const) expect(coordActions(status)).toEqual([]);
  });
});

describe("excepciones de administración", () => {
  const now = new Date("2026-10-18T12:00:00Z").getTime();
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const base = { paymentStatus: "pendiente", courierId: null as string | null, channel: "web" };

  it("detecta lo que está atascado y respeta los umbrales", () => {
    const result = classifyExceptions(
      [
        { ...base, number: 1, status: "listo", updatedAt: ago(1) },
        { ...base, number: 2, status: "listo", courierId: "c1", updatedAt: ago(90) },
        { ...base, number: 3, status: "por_confirmar", updatedAt: ago(25) },
        { ...base, number: 4, status: "por_confirmar", updatedAt: ago(5) },
        { ...base, number: 5, status: "en_camino", courierId: "c1", updatedAt: ago(75) },
        { ...base, number: 6, status: "en_camino", courierId: "c1", updatedAt: ago(30) },
        { ...base, number: 7, status: "cancelado", paymentStatus: "reembolso_pendiente", updatedAt: ago(2) },
      ],
      now,
    );
    expect(result.sin_repartidor.map((o) => o.number)).toEqual([1]);
    expect(result.sin_respuesta.map((o) => o.number)).toEqual([3]);
    expect(result.en_camino_largo.map((o) => o.number)).toEqual([5]);
    expect(result.reembolso_pendiente.map((o) => o.number)).toEqual([7]);
  });

  it("ignora las ventas de mostrador", () => {
    const result = classifyExceptions([{ ...base, channel: "mostrador", number: 9, status: "listo", updatedAt: ago(1) }], now);
    expect(result.sin_repartidor).toEqual([]);
  });
});
