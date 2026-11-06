import { describe, expect, it } from "vitest";
import { isCreditNote, isInvoiceKind, sortInvoices, type InvoiceRow } from "./invoices";

const row = (kind: string, number: string, issued_at = "2026-11-05T20:00:00Z"): InvoiceRow => ({ id: number, kind, number, issued_at, total: 10, credit_for: null });

describe("sortInvoices", () => {
  it("pone las facturas primero (venta, servicio) y después las notas de crédito", () => {
    const sorted = sortInvoices([row("nota_credito_servicio", "NCS"), row("servicio", "S"), row("nota_credito_venta", "NCV"), row("venta", "V")]);
    expect(sorted.map((r) => r.number)).toEqual(["V", "S", "NCV", "NCS"]);
  });
  it("ignora tipos que no conoce", () => {
    expect(sortInvoices([row("otra_cosa", "X"), row("venta", "V")]).map((r) => r.number)).toEqual(["V"]);
  });
});

describe("tipos", () => {
  it("reconoce los tipos y las notas de crédito", () => {
    expect(isInvoiceKind("servicio")).toBe(true);
    expect(isInvoiceKind("recibo")).toBe(false);
    expect(isCreditNote("nota_credito_venta")).toBe(true);
    expect(isCreditNote("venta")).toBe(false);
  });
});
