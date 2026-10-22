import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { orderStatuses, type OrderStatus } from "@/lib/orders";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { orderDistance, setOrderStatus } from "./actions";
import { OrdersWorkspace, type OrderItem, type OrderRow } from "./orders-workspace";

export const metadata = { title: "Pedidos" };

export default async function PedidosPage() {
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const orders = await supabase
    .from("orders_list")
    .select("id, number, store_name, status, payment_method, payment_status, subtotal, delivery_fee, total, item_count, status_reason, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const ids = (orders.data ?? []).flatMap((row) => (row.id ? [row.id] : []));
  const items = ids.length ? await supabase.from("order_items_list").select("order_id, product_name, variant_name, unit_price, quantity, line_total").in("order_id", ids) : { data: [], error: null };
  const failed = orders.error || items.error;
  if (failed) console.error("[pedidos]", orders.error?.message, items.error?.message);

  const itemsByOrder: Record<string, OrderItem[]> = {};
  for (const row of items.data ?? []) {
    if (!row.order_id || !row.product_name) continue;
    (itemsByOrder[row.order_id] ??= []).push({ name: `${row.product_name} · ${row.variant_name}`, quantity: Number(row.quantity ?? 0), unitPrice: Number(row.unit_price ?? 0), total: Number(row.line_total ?? 0) });
  }

  const rows: OrderRow[] = (orders.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    return row.id && row.number !== null && status
      ? [
          {
            id: row.id,
            number: Number(row.number),
            store: row.store_name ?? "",
            status,
            paymentMethod: row.payment_method,
            paymentStatus: row.payment_status,
            subtotal: Number(row.subtotal ?? 0),
            deliveryFee: Number(row.delivery_fee ?? 0),
            total: Number(row.total ?? 0),
            itemCount: Number(row.item_count ?? 0),
            reason: row.status_reason,
            deadline: row.expires_at && (status === "por_confirmar" || status === "pendiente_pago") ? formatStoreDateTime(row.expires_at) : null,
            createdAt: formatStoreDateTime(row.created_at),
            items: itemsByOrder[row.id] ?? [],
          },
        ]
      : [];
  });

  return (
    <>
      <PageHeader title="Pedidos" description="Confirma los pedidos nuevos y llévalos hasta que estén listos. La lista se actualiza sola." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar los pedidos. Recarga la página.</Alert> : null}
      <OrdersWorkspace rows={rows} setStatus={setOrderStatus} loadDistance={orderDistance} />
    </>
  );
}
