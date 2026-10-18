import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { closeCashSession, createCounterSale, openCashSession, voidCounterSale } from "./actions";
import { CashWorkspace, type CatalogRow, type Sale, type Shift } from "./cash-workspace";

export const metadata = { title: "Caja y venta" };

export default async function CajaPage() {
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const shifts = await supabase
    .from("cash_sessions_list")
    .select("id, opened_at, opening_amount, closed_at, difference, note, sales_count, sales_total, cash_total, cash_expected")
    .order("opened_at", { ascending: false })
    .limit(6);
  if (shifts.error) console.error("[caja:turnos]", shifts.error.message);

  const rows = shifts.data ?? [];
  const toShift = (row: (typeof rows)[number]): Shift | null =>
    row.id ? { id: row.id, openedAt: formatDateTime(row.opened_at), opening: Number(row.opening_amount ?? 0), closed: Boolean(row.closed_at), difference: row.difference === null ? null : Number(row.difference), note: row.note, salesCount: Number(row.sales_count ?? 0), salesTotal: Number(row.sales_total ?? 0), cashExpected: Number(row.cash_expected ?? 0) } : null;
  const open = rows.find((row) => !row.closed_at);
  const history = rows.filter((row) => row.closed_at).flatMap((row) => toShift(row) ?? []);

  let catalog: CatalogRow[] = [];
  let sales: Sale[] = [];
  let failed = Boolean(shifts.error);
  if (open?.id) {
    const [cat, orders] = await Promise.all([
      supabase.rpc("counter_catalog"),
      supabase.from("orders_list").select("id, number, store_name, status, payment_method, total, created_at").eq("cash_session_id", open.id).order("created_at", { ascending: false }),
    ]);
    if (cat.error || orders.error) {
      failed = true;
      console.error("[caja:venta]", cat.error?.message, orders.error?.message);
    }
    catalog = (cat.data ?? []).map((row) => ({ storeId: row.store_id, storeName: row.store_name, variantId: row.variant_id, product: row.product_name, variant: row.variant_name, sku: row.sku, price: Number(row.price), quantity: row.quantity }));
    sales = (orders.data ?? []).flatMap((row) => (row.id && row.number !== null ? [{ id: row.id, number: Number(row.number), store: row.store_name ?? "", voided: row.status === "cancelado", method: row.payment_method === "tarjeta" ? ("tarjeta" as const) : ("efectivo" as const), total: Number(row.total ?? 0), at: formatDateTime(row.created_at) }] : []));
  }

  return (
    <>
      <PageHeader title="Caja y venta" description="Abre tu turno, registra las ventas de mostrador y cierra contando el efectivo." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página antes de vender.</Alert> : null}
      <CashWorkspace shift={open ? toShift(open) : null} history={history} catalog={catalog} sales={sales} actions={{ openCashSession, closeCashSession, createCounterSale, voidCounterSale }} />
    </>
  );
}
