import { Alert, Badge, Button, Card, DataTable, Field, SelectField } from "@rapitrip/ui";
import { Download, Filter } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { first, type SearchParams } from "@/lib/filters";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { invoiceKindLabel, invoiceKinds, isCreditNote, isInvoiceKind, ledgerQuery, ledgerRange, ledgerTotals, parseLedgerFilters } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { paymentLabel } from "@/lib/orders";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Libro de facturas" };

const LIMIT = 2000;

/** Libro contable de Rapitrip: todas las facturas y notas de crédito emitidas, con filtros y exportación a CSV. Sin validez fiscal. */
export default async function FacturasPage({ searchParams }: { searchParams: SearchParams }) {
  await requireConsoleAccess("admin");
  const raw = await searchParams;
  const filters = parseLedgerFilters({
    desde: first(raw.desde),
    hasta: first(raw.hasta),
    comercio: first(raw.comercio),
    metodo: first(raw.metodo),
    tipo: first(raw.tipo),
  });
  const { from, to } = ledgerRange(filters);

  const supabase = await serverSupabase();
  const [ledger, commerces] = await Promise.all([
    supabase.rpc("invoice_ledger", { p_from: from, p_to: to, p_commerce: filters.comercio, p_method: filters.metodo, p_kind: filters.tipo, p_limit: LIMIT }),
    supabase.from("commerces_list").select("id, name").order("name"),
  ]);
  const failed = Boolean(ledger.error);
  if (ledger.error) console.error("[facturas:libro]", ledger.error.message);
  if (commerces.error) console.error("[facturas:comercios]", commerces.error.message);

  const rows = (ledger.data ?? []).flatMap((row) => (isInvoiceKind(row.kind) ? [{ ...row, kind: row.kind }] : []));
  const totals = ledgerTotals(rows);
  const csvHref = `/admin/facturas/exportar${ledgerQuery(filters)}`;

  return (
    <>
      <PageHeader title="Libro de facturas" description="Facturas de venta y de servicio que Rapitrip emite por cada pedido, y las notas de crédito que las anulan. Son comprobantes internos, sin validez fiscal." />
      <Card outerClassName="mb-5">
        <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Desde" name="desde" type="date" defaultValue={filters.desde} />
          <Field label="Hasta" name="hasta" type="date" defaultValue={filters.hasta} />
          <SelectField label="Comercio" name="comercio" defaultValue={filters.comercio ?? ""}>
            <option value="">Todos</option>
            {(commerces.data ?? []).flatMap((commerce) => (commerce.id && commerce.name ? [<option key={commerce.id} value={commerce.id}>{commerce.name}</option>] : []))}
          </SelectField>
          <SelectField label="Método de pago" name="metodo" defaultValue={filters.metodo ?? ""}>
            <option value="">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
          </SelectField>
          <SelectField label="Tipo de documento" name="tipo" defaultValue={filters.tipo ?? ""}>
            <option value="">Todos</option>
            {invoiceKinds.map((kind) => (
              <option key={kind} value={kind}>
                {invoiceKindLabel[kind]}
              </option>
            ))}
          </SelectField>
          <div className="flex flex-wrap items-end gap-2">
            <Button variant="secondary" type="submit">
              <Filter className="size-4" aria-hidden="true" />
              Filtrar
            </Button>
            <Link href="/admin/facturas" className="inline-flex min-h-11 items-center px-3 text-[13px] font-bold text-hoja underline underline-offset-2">
              Limpiar filtros
            </Link>
          </div>
        </form>
      </Card>

      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar el libro. Recarga la página.</Alert> : null}
      {rows.length >= LIMIT ? <Alert tone="warning" className="mb-5">Hay más de {LIMIT} documentos en este rango: se muestran los más recientes y las sumas son parciales. Acota las fechas.</Alert> : null}

      <dl className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Total label="Facturado" value={totals.facturado} hint={`Venta ${formatMoney(totals.ventas)} · Servicio ${formatMoney(totals.servicios)}`} />
        <Total label="Acreditado por notas" value={totals.acreditado} hint={`Venta ${formatMoney(totals.notasVenta)} · Servicio ${formatMoney(totals.notasServicio)}`} />
        <Total label="Neto" value={totals.neto} hint="Facturado menos acreditado" strong />
      </dl>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-tinta-suave">
          {rows.length} {rows.length === 1 ? "documento" : "documentos"} del {formatDate(`${filters.desde}T12:00:00Z`)} al {formatDate(`${filters.hasta}T12:00:00Z`)}
        </p>
        <a href={csvHref} className="inline-flex min-h-10 items-center gap-1.5 rounded-pill border border-borde px-4 text-[13px] font-bold text-hoja hover:bg-menta">
          <Download className="size-4" aria-hidden="true" />
          Descargar CSV
        </a>
      </div>

      <DataTable
        caption="Facturas y notas de crédito"
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="No hay documentos con esos filtros"
        emptyHint="Se emiten cuando un pedido pasa a «por confirmar»."
        columns={[
          { header: "Generada", cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.issued_at)}</span> },
          {
            header: "Documento",
            cell: (row) => (
              <span>
                <span className="block font-mono text-[13px] font-bold text-tinta">{row.number}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-tinta-suave">
                  {invoiceKindLabel[row.kind]}
                  {isCreditNote(row.kind) ? <Badge tone="warning">Anulación</Badge> : null}
                </span>
                {row.credit_for_number ? <span className="block text-xs text-tinta-suave">Anula {row.credit_for_number}</span> : null}
              </span>
            ),
          },
          { header: "Pedido", cell: (row) => <Link href={`/admin/pedidos/${row.order_number}`} className="font-bold text-hoja underline underline-offset-2">#{row.order_number}</Link> },
          { header: "Comercio", cell: (row) => row.commerce_name },
          { header: "Pago", cell: (row) => paymentLabel(row.payment_method, row.payment_status) },
          { header: "Total", className: "text-right", cell: (row) => <span className="whitespace-nowrap font-bold tabular-nums">{isCreditNote(row.kind) ? "−" : ""}{formatMoney(Number(row.total))}</span> },
          {
            header: "PDF",
            cell: (row) => (
              <a href={`/facturas/${row.id}`} target="_blank" rel="noopener" aria-label={`Descargar PDF de ${row.number}`} className="inline-flex items-center gap-1.5 font-bold text-hoja underline underline-offset-2">
                <Download className="size-4" aria-hidden="true" />
                PDF
              </a>
            ),
          },
        ]}
      />
    </>
  );
}

function Total({ label, value, hint, strong = false }: { label: string; value: number; hint: string; strong?: boolean }) {
  return (
    <div className={`rounded-panel px-4 py-3 ring-1 ring-borde ${strong ? "bg-menta" : "bg-crema"}`}>
      <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
      <dd className="text-[22px] font-extrabold tabular-nums text-tinta">{formatMoney(value)}</dd>
      <p className="text-xs text-tinta-suave">{hint}</p>
    </div>
  );
}
