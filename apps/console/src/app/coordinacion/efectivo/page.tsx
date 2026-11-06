import { Alert } from "@rapitrip/ui";
import { AccountabilityCard, CashKpis, CustodyCard, HandoffHistoryCard } from "@/components/cash-control";
import { PageHeader } from "@/components/shell";
import { startHandoffFor } from "@/lib/cash-control-actions";
import { loadCashControl } from "@/lib/load-cash-control";
import { requireConsoleAccess } from "@/lib/guard";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { registerCourierCash } from "./actions";
import { CourierCashPanel, type DeliveredCash } from "./courier-cash-panel";

export const metadata = { title: "Efectivo de repartidores" };

export default async function EfectivoPage() {
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const [control, orders, couriers] = await Promise.all([
    loadCashControl(supabase),
    supabase
      .from("orders_list")
      .select("id, number, store_name, total, payment_ref, cash_received_at, cash_collected, courier_id, delivered_at")
      .eq("channel", "web")
      .eq("payment_method", "efectivo")
      .eq("status", "entregado")
      .order("delivered_at", { ascending: false })
      .limit(100),
    supabase.from("couriers_list").select("id, full_name, user_id"),
  ]);
  if (orders.error || couriers.error) console.error("[efectivo]", orders.error?.message, couriers.error?.message);

  const names = new Map((couriers.data ?? []).flatMap((row) => (row.id ? [[row.id, row.full_name ?? ""] as const] : [])));
  const accounts = new Map((couriers.data ?? []).flatMap((row) => (row.id ? [[row.id, row.user_id !== null] as const] : [])));
  const rows: DeliveredCash[] = (orders.data ?? []).flatMap((row) => {
    if (!row.id || row.number === null) return [];
    return [
      {
        id: row.id,
        number: Number(row.number),
        store: row.store_name ?? "",
        total: Number(row.total ?? 0),
        collected: row.cash_collected === null ? null : Number(row.cash_collected),
        code: row.payment_ref ?? null,
        received: row.cash_received_at !== null,
        courier: row.courier_id ? (names.get(row.courier_id) ?? "Repartidor") : "Sin repartidor",
        hasAccount: row.courier_id ? (accounts.get(row.courier_id) ?? false) : false,
        deliveredAt: formatStoreDateTime(row.delivered_at),
      },
    ];
  });

  return (
    <>
      <PageHeader title="Efectivo de repartidores" description="Quién tiene el efectivo cobrado, cada entrega a caja y las faltas que quedan registradas." />
      <Alert tone="info" className="mb-5">
        El repartidor con cuenta envía «Efectivo entregado» a una caja desde su aplicación y el cajero lo cuenta y confirma. Para quien no tiene cuenta, registra aquí el cobro y envía tú la entrega a caja.
      </Alert>
      {orders.error || control.failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <div className="flex flex-col gap-5">
        <CashKpis custody={control.custody} open={control.open} />
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <CustodyCard rows={control.custody} points={control.points} start={startHandoffFor} />
          <AccountabilityCard open={control.open} resolved={control.resolved} />
        </div>
        <HandoffHistoryCard rows={control.handoffs} />
        <CourierCashPanel rows={rows} register={registerCourierCash} />
      </div>
    </>
  );
}
