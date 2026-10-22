import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { orderStatuses, type OrderStatus } from "@/lib/orders";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { cancelOrder, orderRoute } from "./actions";
import { OrdersBoard, type AdminOrder } from "./orders-board";

export const metadata = { title: "Pedidos" };

export default async function PedidosAdminPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const { pedido } = await searchParams;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [orders, couriers, staff] = await Promise.all([
    supabase
      .from("orders_list")
      .select("id, number, channel, store_name, status, payment_method, payment_status, subtotal, delivery_fee, total, item_count, courier_id, cashier_id, status_reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("couriers_list").select("id, full_name"),
    supabase.from("accounts_staff").select("user_id, full_name").eq("role", "cajero"),
  ]);
  const ids = (orders.data ?? []).flatMap((row) => (row.id ? [row.id] : []));
  const [delivery, items] = ids.length
    ? await Promise.all([
        supabase.from("order_delivery_list").select("order_id, address, phone, notes").in("order_id", ids),
        supabase.from("order_items_list").select("order_id, product_name, variant_name, quantity, line_total").in("order_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const failed = orders.error || couriers.error || staff.error || delivery.error || items.error;
  if (failed) console.error("[admin:pedidos]", orders.error?.message, couriers.error?.message, staff.error?.message, delivery.error?.message, items.error?.message);

  const courierName = new Map((couriers.data ?? []).flatMap((row) => (row.id ? [[row.id, row.full_name ?? ""] as const] : [])));
  const cashierName = new Map((staff.data ?? []).flatMap((row) => (row.user_id ? [[row.user_id, row.full_name ?? "Cajero"] as const] : [])));
  const deliveryByOrder = new Map((delivery.data ?? []).flatMap((row) => (row.order_id ? [[row.order_id, row] as const] : [])));
  const itemsByOrder: Record<string, { name: string; quantity: number; total: number }[]> = {};
  for (const row of items.data ?? []) {
    if (!row.order_id || !row.product_name) continue;
    (itemsByOrder[row.order_id] ??= []).push({ name: `${row.product_name} · ${row.variant_name}`, quantity: Number(row.quantity ?? 0), total: Number(row.line_total ?? 0) });
  }

  const rows: AdminOrder[] = (orders.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    if (!row.id || row.number === null || !status) return [];
    const info = deliveryByOrder.get(row.id);
    return [
      {
        id: row.id,
        number: Number(row.number),
        channel: row.channel === "mostrador" ? ("mostrador" as const) : ("web" as const),
        store: row.store_name ?? "",
        status,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        subtotal: Number(row.subtotal ?? 0),
        deliveryFee: Number(row.delivery_fee ?? 0),
        total: Number(row.total ?? 0),
        courier: row.courier_id ? (courierName.get(row.courier_id) ?? null) : null,
        cashier: row.cashier_id ? (cashierName.get(row.cashier_id) ?? null) : null,
        reason: row.status_reason,
        createdAt: formatStoreDateTime(row.created_at),
        address: info?.address ?? null,
        phone: info?.phone ?? null,
        notes: info?.notes ?? null,
        items: itemsByOrder[row.id] ?? [],
      },
    ];
  });

  return (
    <>
      <PageHeader title="Pedidos" description="Todos los pedidos de la tienda web y las ventas de mostrador. Los últimos 200." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <OrdersBoard rows={rows} initialNumber={pedido && /^\d{1,9}$/.test(pedido) ? Number(pedido) : null} cancel={cancelOrder} loadRoute={orderRoute} />
    </>
  );
}
