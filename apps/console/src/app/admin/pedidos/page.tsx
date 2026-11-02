import { Alert } from "@rapitrip/ui";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { orderStatuses, type OrderStatus } from "@/lib/orders";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { OrdersBoard, type AdminOrder } from "./orders-board";

export const metadata = { title: "Pedidos" };

/** Todos los pedidos a todo el ancho, con cifras y filtros; cada pedido abre su ficha en /admin/pedidos/[número]. */
export default async function PedidosAdminPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const { pedido } = await searchParams;
  // Los enlaces de antes (excepciones, devoluciones) llevaban ?pedido=N: ahora van directo a la ficha.
  if (pedido && /^\d{1,9}$/.test(pedido)) redirect(`/admin/pedidos/${pedido}`);
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [orders, couriers, staff] = await Promise.all([
    supabase
      .from("orders_list")
      .select("id, number, channel, store_name, status, payment_method, payment_status, total, courier_id, cashier_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("couriers_list").select("id, full_name"),
    supabase.from("accounts_staff").select("user_id, full_name").eq("role", "cajero"),
  ]);
  const failed = orders.error || couriers.error || staff.error;
  if (failed) console.error("[admin:pedidos]", orders.error?.message, couriers.error?.message, staff.error?.message);

  const courierName = new Map((couriers.data ?? []).flatMap((row) => (row.id ? [[row.id, row.full_name ?? ""] as const] : [])));
  const cashierName = new Map((staff.data ?? []).flatMap((row) => (row.user_id ? [[row.user_id, row.full_name ?? "Cajero"] as const] : [])));
  const rows: AdminOrder[] = (orders.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    if (!row.id || row.number === null || !status) return [];
    return [
      {
        id: row.id,
        number: Number(row.number),
        channel: row.channel === "mostrador" ? ("mostrador" as const) : ("web" as const),
        store: row.store_name ?? "",
        status,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        total: Number(row.total ?? 0),
        person: row.channel === "mostrador" ? (row.cashier_id ? (cashierName.get(row.cashier_id) ?? null) : null) : row.courier_id ? (courierName.get(row.courier_id) ?? null) : null,
        createdAt: formatStoreDateTime(row.created_at),
      },
    ];
  });

  return (
    <>
      <PageHeader title="Pedidos" description="Todos los pedidos de la tienda web y las ventas de mostrador. Los últimos 200." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <OrdersBoard rows={rows} />
    </>
  );
}
