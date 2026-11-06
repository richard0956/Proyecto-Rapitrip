import { Badge } from "@rapitrip/ui";
import { Download } from "lucide-react";
import { invoiceKindLabel, isCreditNote, type InvoiceItem } from "@/lib/invoices";

/** Documentos de un pedido con el enlace a su PDF. Son comprobantes internos de Rapitrip, sin validez fiscal. */
export function InvoicesList({ invoices }: { invoices: InvoiceItem[] }) {
  return (
    <ul className="flex flex-col divide-y divide-borde text-sm">
      {invoices.map((invoice) => (
        <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-bold text-tinta">
              {invoiceKindLabel[invoice.kind]}
              {isCreditNote(invoice.kind) ? <Badge tone="warning">Anulación</Badge> : null}
            </p>
            <p className="text-xs text-tinta-suave">
              <span className="font-mono">{invoice.number}</span> · {invoice.issuedLabel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold tabular-nums text-tinta">{invoice.totalLabel}</span>
            <a
              href={`/facturas/${invoice.id}`}
              target="_blank"
              rel="noopener"
              aria-label={`Descargar PDF de ${invoiceKindLabel[invoice.kind]} ${invoice.number}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-borde px-3 text-[13px] font-bold text-hoja hover:bg-menta"
            >
              <Download aria-hidden="true" className="size-4" />
              PDF
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
