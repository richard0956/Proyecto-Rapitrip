import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { toVehicleClass } from "@/lib/courier-fit";
import { toDeliveryClass } from "@/lib/delivery-class";
import { orderStatuses, type OrderStatus } from "@/lib/orders";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { assignCourier, orderRoute, reclassifyOrder, setOrderStatus } from "./actions";
import { DispatchWorkspace, type Courier, type DispatchOrder } from "./dispatch-workspace";

export const metadata = { title: "Pedidos" };

export default async function CoordinacionPage() {
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const [orders, couriers] = await Promise.all([
    supabase
      .from("orders_list")
      .select("id, number, store_name, status, payment_method, payment_status, subtotal, delivery_fee, total, item_count, courier_id, status_reason, created_at, delivery_class, origin_department, destination_department, eta_min_days, eta_max_days, reclassified_reason")
      .eq("channel", "web")
      .order("updated_at", { ascending: false })
      .limit(150),
    supabase.from("couriers_list").select("id, full_name, phone, vehicle_type, status, vehicle_class, department").eq("status", "activo").order("full_name"),
  ]);
  const ids = (orders.data ?? []).flatMap((row) => (row.id ? [row.id] : []));
  const [delivery, items] = ids.length
    ? await Promise.all([
        supabase.from("order_delivery_list").select("order_id, address, phone, notes").in("order_id", ids),
        supabase.from("order_items_list").select("order_id, product_name, variant_name, quantity, line_total").in("order_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const failed = orders.error || couriers.error || delivery.error || items.error;
  if (failed) console.error("[coordinacion]", orders.error?.message, couriers.error?.message, delivery.error?.message, items.error?.message);

  const deliveryByOrder = new Map((delivery.data ?? []).flatMap((row) => (row.order_id ? [[row.order_id, row] as const] : [])));
  const itemsByOrder: Record<string, { name: string; quantity: number; total: number }[]> = {};
  for (const row of items.data ?? []) {
    if (!row.order_id || !row.product_name) continue;
    (itemsByOrder[row.order_id] ??= []).push({ name: `${row.product_name} · ${row.variant_name}`, quantity: Number(row.quantity ?? 0), total: Number(row.line_total ?? 0) });
  }
  const courierList: Courier[] = (couriers.data ?? []).flatMap((row) => (row.id && row.full_name ? [{ id: row.id, name: row.full_name, vehicle: row.vehicle_type ?? "", phone: row.phone ?? "", vehicleClass: toVehicleClass(row.vehicle_class), department: row.department }] : []));

  const rows: DispatchOrder[] = (orders.data ?? []).flatMap((row) => {
    const status = orderStatuses.find((value): value is OrderStatus => value === row.status);
    if (!row.id || row.number === null || !status) return [];
    const info = deliveryByOrder.get(row.id);
    return [
      {
        id: row.id,
        number: Number(row.number),
        store: row.store_name ?? "",
        status,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        total: Number(row.total ?? 0),
        deliveryFee: Number(row.delivery_fee ?? 0),
        subtotal: Number(row.subtotal ?? 0),
        courierId: row.courier_id,
        reason: row.status_reason,
        createdAt: formatStoreDateTime(row.created_at),
        address: info?.address ?? null,
        phone: info?.phone ?? null,
        notes: info?.notes ?? null,
        items: itemsByOrder[row.id] ?? [],
        deliveryClass: toDeliveryClass(row.delivery_class),
        originDepartment: row.origin_department,
        destinationDepartment: row.destination_department,
        etaMinDays: row.eta_min_days,
        etaMaxDays: row.eta_max_days,
        reclassifiedReason: row.reclassified_reason,
      },
    ];
  });

  return (
    <>
      <PageHeader title="Pedidos" description="Asigna repartidor, despacha y marca las entregas. La lista se actualiza sola." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <DispatchWorkspace rows={rows} couriers={courierList} setStatus={setOrderStatus} assign={assignCourier} reclassify={reclassifyOrder} loadRoute={orderRoute} />
    </>
  );
}
