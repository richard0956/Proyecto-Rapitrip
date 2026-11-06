import { Badge, Card } from "@rapitrip/ui";
import { Download, FileText } from "lucide-react";
import { invoiceKindHint, invoiceKindLabel, isCreditNote, type InvoiceKind } from "@/lib/invoices";

export type InvoiceItem = { id: string; kind: InvoiceKind; number: string; issuedLabel: string; totalLabel: string };

/** Facturas y notas de crédito del pedido, con su PDF. Son comprobantes internos de Rapitrip, sin validez fiscal. */
export function InvoicesCard({ orderId, invoices }: { orderId: string; invoices: InvoiceItem[] }) {
  if (invoices.length === 0) return null;
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-tinta">
        <FileText aria-hidden="true" className="size-5 text-hoja" />
        Facturas
      </h2>
      <p className="mt-1 text-[13px] text-tinta-suave">Comprobantes internos de Rapitrip, sin validez fiscal.</p>
      <ul className="mt-3 flex flex-col divide-y divide-borde">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-tinta">
                {invoiceKindLabel[invoice.kind]}
                {isCreditNote(invoice.kind) ? <Badge tone="warning">Anulación</Badge> : null}
              </p>
              <p className="text-[12.5px] text-tinta-suave">
                <span className="font-mono">{invoice.number}</span> · {invoice.issuedLabel}
              </p>
              <p className="text-[12.5px] text-tinta-suave">{invoiceKindHint[invoice.kind]}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[14px] font-extrabold text-tinta">{invoice.totalLabel}</span>
              <a
                href={`/pedidos/${orderId}/facturas/${invoice.id}`}
                target="_blank"
                rel="noopener"
                aria-label={`Descargar PDF de ${invoiceKindLabel[invoice.kind]} ${invoice.number}`}
                className="inline-flex items-center gap-1.5 rounded-pill border border-borde px-3 py-1.5 text-[13px] font-bold text-hoja hover:bg-menta"
              >
                <Download aria-hidden="true" className="size-4" />
                PDF
              </a>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
