import { describe, expect, it } from "vitest";
import { classLabel, deliveryTotal, etaText, reasonText, shipmentCount, shipmentSubtotal, type GroupQuote, type Shipment } from "./delivery-class";

const express: Shipment = { delivery_class: "express", reason: null, items: [{ variant_id: "v1", quantity: 1 }], zone: 1, band: null, customer_fee: 50, eta_min_days: null, eta_max_days: null };
const programado: Shipment = { delivery_class: "programado", reason: "producto", items: [{ variant_id: "v2", quantity: 1 }], zone: null, band: 1, customer_fee: 120, eta_min_days: 3, eta_max_days: 7 };

describe("delivery-class", () => {
  it("nombra la clase", () => {
    expect(classLabel(express)).toBe("Express");
    expect(classLabel(programado)).toBe("Programado");
  });

  it("dice el plazo en horas o en días", () => {
    expect(etaText(express)).toBe("Llega en pocas horas");
    expect(etaText(programado)).toBe("Llega en 3 a 7 días");
    expect(etaText({ ...programado, eta_min_days: 2, eta_max_days: 2 })).toBe("Llega en 2 días");
    expect(etaText({ ...programado, eta_min_days: 1, eta_max_days: 1 })).toBe("Llega en 1 día");
    expect(etaText({ ...programado, eta_min_days: null, eta_max_days: null })).toBe("Se entrega en días");
  });

  it("explica por qué es programado", () => {
    expect(reasonText("producto")).toMatch(/vehículo/);
    expect(reasonText("distancia")).toMatch(/20 km/);
    expect(reasonText("otro_departamento")).toMatch(/otro departamento/);
    expect(reasonText(null)).toBeNull();
  });

  it("suma los precios de los productos de cada envío", () => {
    const quote = { lines: [{ variant_id: "v1", line_total: 100 }, { variant_id: "v2", line_total: 8000 }] } as never;
    expect(shipmentSubtotal(express, quote)).toBe(100);
    expect(shipmentSubtotal(programado, quote)).toBe(8000);
    expect(shipmentSubtotal(express, null)).toBe(0);
  });

  it("cuenta los envíos y suma su costo entre tiendas", () => {
    const quotes: Record<string, GroupQuote | undefined> = {
      a: { origin_department: "managua", destination_department: "managua", shipments: [express, programado] },
      b: { origin_department: null, destination_department: "managua", shipments: [express] },
      c: undefined,
    };
    expect(shipmentCount(quotes)).toBe(3);
    expect(deliveryTotal(quotes)).toBe(220);
  });
});
