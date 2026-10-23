import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { registerCourierCash } from "./actions";
import { CourierCashPanel, type DeliveredCash } from "./courier-cash-panel";

export const metadata = { title: "Efectivo de repartidores" };

export default async function EfectivoPage() {
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const [orders, couriers] = await Promise.all([
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
      <PageHeader title="Efectivo de repartidores" description="Lo que cobró cada repartidor al entregar y lo que caja ya recibió. Las diferencias aparecen marcadas." />
      <Alert tone="info" className="mb-5">
        Quien usa la aplicación registra el efectivo al entregar y recibe un código que lleva al cajero. Solo se registra aquí el efectivo de un repartidor sin cuenta.
      </Alert>
      {orders.error ? <Alert tone="error" className="mb-5">No pudimos cargar los pedidos. Recarga la página.</Alert> : null}
      <CourierCashPanel rows={rows} register={registerCourierCash} />
    </>
  );
}
