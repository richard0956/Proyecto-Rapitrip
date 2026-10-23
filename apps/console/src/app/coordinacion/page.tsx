import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { toVehicleClass } from "@/lib/courier-fit";
import { toDeliveryClass } from "@/lib/delivery-class";
import { orderStatuses, type OrderStatus } from "@/lib/orders";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import type { OfferInfo } from "@/lib/offers";
import type { IssueInfo } from "@/components/delivery-issues";
import { assignCourier, cancelOffer, offerableCouriers, offerOrder, orderRoute, orderTrace, reclassifyOrder, resetCode, resolveIssue, setOrderStatus } from "./actions";
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
    supabase.from("couriers_list").select("id, full_name, phone, vehicle_type, status, vehicle_class, department, user_id, available, push_enabled").order("full_name"),
  ]);
  const ids = (orders.data ?? []).flatMap((row) => (row.id ? [row.id] : []));
  const [delivery, items, offerRows, issueRows] = ids.length
    ? await Promise.all([
        supabase.from("order_delivery_list").select("order_id, address, phone, notes").in("order_id", ids),
        supabase.from("order_items_list").select("order_id, product_name, variant_name, quantity, line_total").in("order_id", ids),
        supabase.from("order_offers_list").select("id, order_id, courier_id, status, expires_at, responded_at, reject_reason, offered_at").in("order_id", ids).order("offered_at", { ascending: false }),
        supabase.from("delivery_issues_list").select("id, order_id, kind, reason, created_at").in("order_id", ids).eq("status", "abierta").order("created_at"),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const failed = orders.error || couriers.error || delivery.error || items.error || offerRows.error || issueRows.error;
  if (failed) console.error("[coordinacion]", orders.error?.message, couriers.error?.message, delivery.error?.message, items.error?.message, offerRows.error?.message, issueRows.error?.message);

  const courierNames = new Map((couriers.data ?? []).flatMap((row) => (row.id ? [[row.id, row.full_name ?? "el repartidor"] as const] : [])));
  const offersByOrder: Record<string, OfferInfo[]> = {};
  for (const row of offerRows.data ?? []) {
    if (!row.id || !row.order_id || !row.expires_at) continue;
    const status = (["pendiente", "aceptada", "rechazada", "vencida", "cancelada"] as const).find((value) => value === row.status);
    if (!status) continue;
    (offersByOrder[row.order_id] ??= []).push({ id: row.id, courierName: row.courier_id ? (courierNames.get(row.courier_id) ?? "el repartidor") : "el repartidor", status, expiresAt: row.expires_at, respondedAt: row.responded_at, rejectReason: row.reject_reason });
  }
  const issuesByOrder: Record<string, IssueInfo[]> = {};
  for (const row of issueRows.data ?? []) {
    if (!row.id || !row.order_id || !row.kind || !row.reason) continue;
    (issuesByOrder[row.order_id] ??= []).push({ id: row.id, kind: row.kind, reason: row.reason, createdAt: formatStoreDateTime(row.created_at) });
  }
  const accountByCourier = new Map((couriers.data ?? []).flatMap((row) => (row.id ? [[row.id, row.user_id !== null] as const] : [])));

  const deliveryByOrder = new Map((delivery.data ?? []).flatMap((row) => (row.order_id ? [[row.order_id, row] as const] : [])));
  const itemsByOrder: Record<string, { name: string; quantity: number; total: number }[]> = {};
  for (const row of items.data ?? []) {
    if (!row.order_id || !row.product_name) continue;
    (itemsByOrder[row.order_id] ??= []).push({ name: `${row.product_name} · ${row.variant_name}`, quantity: Number(row.quantity ?? 0), total: Number(row.line_total ?? 0) });
  }
  const courierList: Courier[] = (couriers.data ?? []).flatMap((row) =>
    row.id && row.full_name && row.status === "activo"
      ? [{ id: row.id, name: row.full_name, vehicle: row.vehicle_type ?? "", phone: row.phone ?? "", vehicleClass: toVehicleClass(row.vehicle_class), department: row.department, available: row.available === true, hasAccount: row.user_id !== null, push: row.push_enabled === true }]
      : [],
  );

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
        offers: offersByOrder[row.id] ?? [],
        issues: issuesByOrder[row.id] ?? [],
        courierHasAccount: row.courier_id ? (accountByCourier.get(row.courier_id) ?? false) : false,
      },
    ];
  });

  return (
    <>
      <PageHeader title="Pedidos" description="Propón cada pedido a un repartidor, sigue su entrega y atiende sus avisos. La lista se actualiza sola." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <DispatchWorkspace
        rows={rows}
        couriers={courierList}
        setStatus={setOrderStatus}
        assign={assignCourier}
        reclassify={reclassifyOrder}
        loadRoute={orderRoute}
        courierApp={{ loadOfferable: offerableCouriers, offer: offerOrder, cancelOffer, resolveIssue, resetCode, loadTrace: orderTrace }}
      />
    </>
  );
}
