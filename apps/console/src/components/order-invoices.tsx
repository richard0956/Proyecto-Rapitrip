"use client";

import { Alert, Card, CardHeader } from "@rapitrip/ui";
import { useEffect, useState } from "react";
import type { InvoiceItem } from "@/lib/invoices";
import { InvoicesList } from "./invoices-list";

export type InvoicesResult = { ok: true; invoices: InvoiceItem[] } | { ok: false; error: string };

/** Facturas del pedido para el comercio (venta y sus notas de crédito). Se piden al abrir el detalle; si aún no hay, no se dibuja nada. */
export function OrderInvoices({ orderId, status, load }: { orderId: string; status: string; load: (id: string) => Promise<InvoicesResult> }) {
  const [result, setResult] = useState<InvoicesResult | null>(null);
  // Un pedido sin pagar todavía no tiene facturas: se emiten cuando pasa a «por confirmar».
  const eligible = status !== "pendiente_pago";

  useEffect(() => {
    let cancelled = false;
    if (eligible) void load(orderId).then((value) => !cancelled && setResult(value));
    return () => {
      cancelled = true;
    };
  }, [orderId, status, eligible, load]);

  if (!eligible || result === null) return null;
  if (!result.ok) return <Alert tone="error" className="mb-3.5">{result.error}</Alert>;
  if (result.invoices.length === 0) return null;
  return (
    <Card outerClassName="mb-3.5" className="p-4">
      <CardHeader title="Facturas" subtitle="Comprobantes internos de Rapitrip, sin validez fiscal" />
      <InvoicesList invoices={result.invoices} />
    </Card>
  );
}
