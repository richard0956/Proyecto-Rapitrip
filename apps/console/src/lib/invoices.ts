import { optionalUuid, queryString, realDay } from "./filters";

export type InvoiceKind = "venta" | "servicio" | "nota_credito_venta" | "nota_credito_servicio";

export const invoiceKindLabel: Record<InvoiceKind, string> = {
  venta: "Factura de venta",
  servicio: "Factura de servicio",
  nota_credito_venta: "Nota de crédito (venta)",
  nota_credito_servicio: "Nota de crédito (servicio)",
};

export const invoiceKinds = Object.keys(invoiceKindLabel) as InvoiceKind[];
export const isInvoiceKind = (value: string | null | undefined): value is InvoiceKind => value !== null && value !== undefined && value in invoiceKindLabel;
export const isCreditNote = (kind: string) => kind.startsWith("nota_credito");

/** Fila ya formateada para mostrar un documento del pedido con su PDF. */
export type InvoiceItem = { id: string; kind: InvoiceKind; number: string; issuedLabel: string; totalLabel: string };

const rank: Record<InvoiceKind, number> = { venta: 0, servicio: 1, nota_credito_venta: 2, nota_credito_servicio: 3 };

/** Primero las facturas (venta, servicio) y después sus notas de crédito; dentro de cada grupo, por fecha. Ignora tipos desconocidos. */
export function sortInvoices<T extends { kind: string; issued_at: string }>(rows: T[]): (T & { kind: InvoiceKind })[] {
  return rows.filter((row): row is T & { kind: InvoiceKind } => isInvoiceKind(row.kind)).sort((a, b) => rank[a.kind] - rank[b.kind] || a.issued_at.localeCompare(b.issued_at));
}

// Libro contable -----------------------------------------------------------------------------------------------------------

/** Nicaragua no tiene horario de verano: el día contable empieza a las 06:00 UTC. */
const OFFSET_HOURS = 6;

export type LedgerFilters = { desde: string; hasta: string; comercio?: string; metodo?: "efectivo" | "tarjeta"; tipo?: InvoiceKind };

/** Día `AAAA-MM-DD` en Managua. */
export const managuaDay = (now: Date = new Date()) => new Date(now.getTime() - OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);

/** Valores de la URL del libro: lo inválido se descarta. Por defecto, del primer día del mes a hoy (hora de Managua). */
export function parseLedgerFilters(raw: Record<string, string | undefined>, now: Date = new Date()): LedgerFilters {
  const today = managuaDay(now);
  let desde = realDay(raw.desde) ?? `${today.slice(0, 8)}01`;
  let hasta = realDay(raw.hasta) ?? today;
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  return {
    desde,
    hasta,
    comercio: optionalUuid.parse(raw.comercio),
    metodo: raw.metodo === "efectivo" || raw.metodo === "tarjeta" ? raw.metodo : undefined,
    tipo: isInvoiceKind(raw.tipo) ? raw.tipo : undefined,
  };
}

/** Rango para la base: desde el comienzo del primer día hasta el comienzo del día siguiente al último (exclusivo). */
export function ledgerRange(filters: Pick<LedgerFilters, "desde" | "hasta">): { from: string; to: string } {
  const start = new Date(`${filters.desde}T00:00:00.000Z`).getTime() + OFFSET_HOURS * 3_600_000;
  const end = new Date(`${filters.hasta}T00:00:00.000Z`).getTime() + (24 + OFFSET_HOURS) * 3_600_000;
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}

export const ledgerQuery = (filters: LedgerFilters) => queryString({ desde: filters.desde, hasta: filters.hasta, comercio: filters.comercio, metodo: filters.metodo, tipo: filters.tipo });

const cents = (value: number | string) => Math.round(Number(value) * 100);

export type LedgerTotals = { ventas: number; servicios: number; notasVenta: number; notasServicio: number; facturado: number; acreditado: number; neto: number };

/** Sumas del libro. `neto` = lo facturado menos lo acreditado por notas de crédito. */
export function ledgerTotals(rows: { kind: string; total: number | string }[]): LedgerTotals {
  const sum = (kind: InvoiceKind) => rows.filter((row) => row.kind === kind).reduce((acc, row) => acc + cents(row.total), 0);
  const ventas = sum("venta");
  const servicios = sum("servicio");
  const notasVenta = sum("nota_credito_venta");
  const notasServicio = sum("nota_credito_servicio");
  const to = (value: number) => value / 100;
  return {
    ventas: to(ventas),
    servicios: to(servicios),
    notasVenta: to(notasVenta),
    notasServicio: to(notasServicio),
    facturado: to(ventas + servicios),
    acreditado: to(notasVenta + notasServicio),
    neto: to(ventas + servicios - notasVenta - notasServicio),
  };
}
