export type InvoiceKind = "venta" | "servicio" | "nota_credito_venta" | "nota_credito_servicio";

/** Fila que devuelve `public.order_invoices`. */
export type InvoiceRow = { id: string; kind: string; number: string; issued_at: string; total: number | string; credit_for: string | null };

export const invoiceKindLabel: Record<InvoiceKind, string> = {
  venta: "Factura de venta",
  servicio: "Factura de servicio",
  nota_credito_venta: "Nota de crédito (venta)",
  nota_credito_servicio: "Nota de crédito (servicio)",
};

export const invoiceKindHint: Record<InvoiceKind, string> = {
  venta: "Los productos de tu pedido.",
  servicio: "El servicio de entrega.",
  nota_credito_venta: "Anula la factura de venta.",
  nota_credito_servicio: "Anula la factura de servicio.",
};

export const isInvoiceKind = (value: string): value is InvoiceKind => value in invoiceKindLabel;

export const isCreditNote = (kind: string) => kind.startsWith("nota_credito");

const order: Record<InvoiceKind, number> = { venta: 0, servicio: 1, nota_credito_venta: 2, nota_credito_servicio: 3 };

/** Primero las facturas (venta, servicio) y después sus notas de crédito; dentro de cada grupo, por fecha. Ignora tipos desconocidos. */
export function sortInvoices(rows: InvoiceRow[]): (InvoiceRow & { kind: InvoiceKind })[] {
  return rows
    .filter((row): row is InvoiceRow & { kind: InvoiceKind } => isInvoiceKind(row.kind))
    .sort((a, b) => order[a.kind] - order[b.kind] || a.issued_at.localeCompare(b.issued_at));
}
