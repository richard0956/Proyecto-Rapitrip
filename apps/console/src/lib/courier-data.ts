import type { CourierStat } from "./couriers";
import type { Period } from "./dashboard";
import { formatDate } from "./format";
import { serverSupabase } from "./supabase";

/** Repartidores con sus estadísticas del periodo. Quien no tiene pedidos aparece con todo en cero. */
export async function loadCourierStats(period: Period): Promise<{ rows: CourierStat[]; failed: boolean }> {
  const supabase = await serverSupabase();
  const [couriers, stats] = await Promise.all([
    supabase.from("couriers_list").select("id, full_name, phone, vehicle_type, status, created_at, user_id, available, push_enabled").order("full_name"),
    supabase.rpc("courier_stats", { p_from: period.from, p_to: period.to }),
  ]);
  const failed = Boolean(couriers.error || stats.error);
  if (failed) console.error("[repartidores]", couriers.error?.message, stats.error?.message);
  const byCourier = new Map((stats.data ?? []).flatMap((row) => (row.courier_id ? [[row.courier_id, row] as const] : [])));

  const rows = (couriers.data ?? []).flatMap((row): CourierStat[] => {
    if (!row.id) return [];
    const stat = byCourier.get(row.id);
    return [
      {
        id: row.id,
        name: row.full_name ?? "Sin nombre",
        phone: row.phone ?? "—",
        vehicle: row.vehicle_type ?? "—",
        status: row.status === "activo" ? "activo" : "inactivo",
        since: formatDate(row.created_at),
        deliveries: Number(stat?.deliveries ?? 0),
        km: Number(stat?.km ?? 0),
        avgMinutes: stat?.avg_minutes === null || stat?.avg_minutes === undefined ? null : Number(stat.avg_minutes),
        activeOrders: Number(stat?.active_orders ?? 0),
        cashPending: Number(stat?.cash_pending ?? 0),
        cashPendingOrders: Number(stat?.cash_pending_orders ?? 0),
        hasAccount: row.user_id !== null,
        available: row.available === true,
        push: row.push_enabled === true,
      },
    ];
  });
  return { rows, failed };
}
