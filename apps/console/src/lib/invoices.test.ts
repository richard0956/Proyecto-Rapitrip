import { describe, expect, it } from "vitest";
import { ledgerQuery, ledgerRange, ledgerTotals, managuaDay, parseLedgerFilters, sortInvoices } from "./invoices";

describe("parseLedgerFilters", () => {
  const now = new Date("2026-11-05T20:00:00Z");
  it("por defecto va del primer día del mes a hoy, en hora de Managua", () => {
    expect(parseLedgerFilters({}, now)).toMatchObject({ desde: "2026-11-01", hasta: "2026-11-05" });
    // 03:00 UTC del 6 todavía es el 5 en Managua.
    expect(managuaDay(new Date("2026-11-06T03:00:00Z"))).toBe("2026-11-05");
  });
  it("descarta fechas, tipos y métodos inválidos y acomoda un rango al revés", () => {
    const f = parseLedgerFilters({ desde: "2026-13-45", hasta: "x", metodo: "bitcoin", tipo: "otra", comercio: "no-uuid" }, now);
    expect(f).toMatchObject({ desde: "2026-11-01", hasta: "2026-11-05", metodo: undefined, tipo: undefined, comercio: undefined });
    expect(parseLedgerFilters({ desde: "2026-11-04", hasta: "2026-11-02" }, now)).toMatchObject({ desde: "2026-11-02", hasta: "2026-11-04" });
  });
  it("acepta los filtros válidos", () => {
    const id = "5c7e356b-28dc-4b25-bc06-ff0340304ed0";
    expect(parseLedgerFilters({ metodo: "tarjeta", tipo: "nota_credito_venta", comercio: id }, now)).toMatchObject({ metodo: "tarjeta", tipo: "nota_credito_venta", comercio: id });
  });
});

describe("ledgerRange", () => {
  it("cubre desde las 00:00 del primer día hasta las 00:00 del día siguiente al último, en Managua", () => {
    expect(ledgerRange({ desde: "2026-11-01", hasta: "2026-11-05" })).toEqual({ from: "2026-11-01T06:00:00.000Z", to: "2026-11-06T06:00:00.000Z" });
  });
});

describe("ledgerTotals", () => {
  it("separa lo facturado de lo acreditado y calcula el neto sin errores de decimales", () => {
    const totals = ledgerTotals([
      { kind: "venta", total: "10.10" },
      { kind: "venta", total: 20.2 },
      { kind: "servicio", total: 50 },
      { kind: "nota_credito_venta", total: "10.10" },
      { kind: "nota_credito_servicio", total: 50 },
    ]);
    expect(totals).toEqual({ ventas: 30.3, servicios: 50, notasVenta: 10.1, notasServicio: 50, facturado: 80.3, acreditado: 60.1, neto: 20.2 });
  });
  it("sin filas todo es cero", () => {
    expect(ledgerTotals([]).neto).toBe(0);
  });
});

describe("otros", () => {
  it("ordena facturas antes que notas y descarta tipos desconocidos", () => {
    const rows = [
      { kind: "nota_credito_venta", issued_at: "2026-11-02", n: "NCV" },
      { kind: "servicio", issued_at: "2026-11-01", n: "S" },
      { kind: "raro", issued_at: "2026-11-01", n: "X" },
      { kind: "venta", issued_at: "2026-11-01", n: "V" },
    ];
    expect(sortInvoices(rows).map((r) => r.n)).toEqual(["V", "S", "NCV"]);
  });
  it("arma la cadena de consulta con solo los filtros presentes", () => {
    expect(ledgerQuery({ desde: "2026-11-01", hasta: "2026-11-05", metodo: "tarjeta" })).toBe("?desde=2026-11-01&hasta=2026-11-05&metodo=tarjeta");
  });
});
