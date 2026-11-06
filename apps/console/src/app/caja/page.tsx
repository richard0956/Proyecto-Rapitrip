import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { closeCashSession, confirmCashHandoff, createCounterSale, loadCashIncidents, openCashSession, rejectCashHandoff, returnCashToCustomer, voidCounterSale } from "./actions";
import { CashWorkspace, type CashReturn, type CatalogRow, type Handoff, type HandoffDone, type Register, type Sale, type Shift } from "./cash-workspace";

export const metadata = { title: "Caja y venta" };

export default async function CajaPage() {
  await requireConsoleAccess("caja");
  const supabase = await serverSupabase();
  const shifts = await supabase
    .from("cash_sessions_list")
    .select("id, opened_at, opening_amount, closed_at, counted_amount, difference, note, sales_count, sales_total, cash_expected, register_id, register_name")
    .order("opened_at", { ascending: false })
    .limit(6);
  if (shifts.error) console.error("[caja:turnos]", shifts.error.message);

  const rows = shifts.data ?? [];
  const toShift = (row: (typeof rows)[number]): Shift | null =>
    row.id ? { id: row.id, openedAt: formatDateTime(row.opened_at), opening: Number(row.opening_amount ?? 0), closed: Boolean(row.closed_at), difference: row.difference === null ? null : Number(row.difference), note: row.note, salesCount: Number(row.sales_count ?? 0), salesTotal: Number(row.sales_total ?? 0), register: row.register_name ?? null } : null;
  const open = rows.find((row) => !row.closed_at);
  const history = rows.filter((row) => row.closed_at).flatMap((row) => toShift(row) ?? []);

  let catalog: CatalogRow[] = [];
  let sales: Sale[] = [];
  let handoffs: Handoff[] = [];
  let handoffsDone: HandoffDone[] = [];
  let registers: Register[] = [];
  // Sin caja elegida, el turno sin caja parte de lo contado en el último cierre del cajero (como antes de las cajas físicas).
  const lastLoose = rows.find((row) => row.closed_at && !row.register_id);
  const looseCounted = lastLoose?.counted_amount == null ? null : Number(lastLoose.counted_amount);
  let pendingReturns: CashReturn[] = [];
  let failed = Boolean(shifts.error);
  if (open?.id) {
    const [pending, done] = await Promise.all([supabase.rpc("cashier_pending_handoffs"), supabase.rpc("cash_handoffs_history", { p_session: open.id, p_limit: 20 })]);
    if (pending.error || done.error) console.error("[caja:entregas]", pending.error?.message, done.error?.message);
    handoffs = (pending.data ?? []).map((row) => ({ id: row.handoff_id, courier: row.courier_name, orders: (row.order_numbers ?? []).map(Number), createdAt: row.created_at, expiresAt: row.expires_at }));
    handoffsDone = (done.data ?? []).filter((row) => row.status !== "pendiente").map((row) => ({ id: row.handoff_id, courier: row.courier_name, status: row.status as HandoffDone["status"], counted: row.counted === null ? null : Number(row.counted), difference: row.difference === null ? null : Number(row.difference), orders: row.orders_count, at: formatDateTime(row.resolved_at ?? row.created_at) }));
    const returns = await supabase.rpc("pending_cash_returns");
    if (returns.error) console.error("[caja:devoluciones]", returns.error.message);
    pendingReturns = (returns.data ?? []).flatMap((row) => (row.request_id ? [{ requestId: row.request_id, orderNumber: Number(row.order_number), store: row.store_name ?? "", total: Number(row.total ?? 0), decidedAt: formatDateTime(row.decided_at) }] : []));
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
  } else {
    const mine = await supabase.rpc("my_cash_registers");
    if (mine.error) console.error("[caja:cajas]", mine.error.message);
    registers = (mine.data ?? []).map((row) => ({ id: row.register_id, name: row.name, code: row.code, mine: Boolean(row.assigned_to_me), lastCounted: row.last_counted === null ? null : Number(row.last_counted) }));
  }

  return (
    <>
      <PageHeader title="Caja y venta" description="Abre tu turno en tu caja, registra las ventas de mostrador, confirma el efectivo de los repartidores y cierra contando la gaveta." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página antes de vender.</Alert> : null}
      <CashWorkspace shift={open ? toShift(open) : null} history={history} catalog={catalog} sales={sales} handoffs={handoffs} handoffsDone={handoffsDone} registers={registers} looseCounted={looseCounted} pendingReturns={pendingReturns} actions={{ openCashSession, closeCashSession, createCounterSale, voidCounterSale, confirmCashHandoff, rejectCashHandoff, loadCashIncidents, returnCashToCustomer }} />
    </>
  );
}
