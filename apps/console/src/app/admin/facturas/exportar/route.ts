import { requireConsoleAccess } from "@/lib/guard";
import { formatStoreDateTime } from "@/lib/stores";
import { invoiceKindLabel, isCreditNote, isInvoiceKind, ledgerRange, parseLedgerFilters } from "@/lib/invoices";
import { paymentLabel } from "@/lib/orders";
import { toCsv } from "@/lib/report-csv";
import { serverSupabase } from "@/lib/supabase";

const LIMIT = 2000;

/** Libro de facturas en CSV con los mismos filtros de la pantalla. Las notas de crédito van en negativo para que la suma dé el neto. */
export async function GET(request: Request) {
  await requireConsoleAccess("admin");
  const query = new URL(request.url).searchParams;
  const filters = parseLedgerFilters({
    desde: query.get("desde") ?? undefined,
    hasta: query.get("hasta") ?? undefined,
    comercio: query.get("comercio") ?? undefined,
    metodo: query.get("metodo") ?? undefined,
    tipo: query.get("tipo") ?? undefined,
  });
  const { from, to } = ledgerRange(filters);

  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("invoice_ledger", { p_from: from, p_to: to, p_commerce: filters.comercio, p_method: filters.metodo, p_kind: filters.tipo, p_limit: LIMIT });
  if (error) {
    console.error("[facturas:exportar]", error.message);
    return new Response("No pudimos generar el libro. Inténtalo de nuevo.", { status: 500 });
  }

  const csv = toCsv(
    (data ?? []).flatMap((row) =>
      isInvoiceKind(row.kind)
        ? [{
            number: row.number,
            kind: invoiceKindLabel[row.kind],
            issued: formatStoreDateTime(row.issued_at),
            order: Number(row.order_number),
            commerce: row.commerce_name,
            payment: row.payment_method === "tarjeta" ? "Tarjeta" : "Efectivo",
            paymentStatus: paymentLabel(row.payment_method, row.payment_status),
            total: (isCreditNote(row.kind) ? -1 : 1) * Number(row.total),
            credits: row.credit_for_number,
          }]
        : [],
    ),
    [
      { key: "number", header: "Número" },
      { key: "kind", header: "Tipo" },
      { key: "issued", header: "Generada" },
      { key: "order", header: "Pedido" },
      { key: "commerce", header: "Comercio" },
      { key: "payment", header: "Método de pago" },
      { key: "paymentStatus", header: "Estado de pago" },
      { key: "total", header: "Importe (notas en negativo)" },
      { key: "credits", header: "Anula" },
    ],
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="libro-facturas-${filters.desde}_${filters.hasta}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
