import { buildTrace, type CashSummary, type TraceEntry } from "./order-trace";
import { orderStatusLabel } from "./orders";
import type { serverSupabase } from "./supabase";

type Supabase = Awaited<ReturnType<typeof serverSupabase>>;

export type TracePhoto = { id: string; kind: string; label: string; takenAt: string; url: string | null; purged: boolean; alert: boolean };
export type TraceResult = { ok: true; entries: TraceEntry[]; photos: TracePhoto[]; cash: CashSummary | null } | { ok: false; error: string };

const photoLabels: Record<string, string> = { recogida: "Recogida", entrega: "Entrega", fallida: "Intento fallido", devolucion_tienda: "Devolución a la tienda" };

/**
 * Lee todo lo que coordinación y administración pueden ver de un pedido y firma por 5 minutos el enlace de cada foto. Las
 * políticas de la base de datos deciden qué se devuelve: este código no amplía el acceso de nadie.
 */
export async function loadOrderTrace(supabase: Supabase, orderId: string): Promise<TraceResult> {
  const [order, events, offers, evidence, issues, couriers] = await Promise.all([
    supabase.from("orders_list").select("payment_method, total, cash_collected, payment_ref, cash_received_at").eq("id", orderId).maybeSingle(),
    supabase.from("order_events_list").select("to_status, reason, created_at").eq("order_id", orderId).order("id"),
    supabase.from("order_offers_list").select("courier_id, status, offered_at, expires_at, responded_at, reject_reason").eq("order_id", orderId),
    supabase.from("order_evidence_list").select("id, kind, file_path, taken_at, flagged, flag_reason, distance_m, units_count, note, purged_at").eq("order_id", orderId).order("taken_at"),
    supabase.from("delivery_issues_list").select("kind, reason, status, created_at, attended_at, attended_note").eq("order_id", orderId),
    supabase.from("couriers_list").select("id, full_name"),
  ]);
  const failure = order.error ?? events.error ?? offers.error ?? evidence.error ?? issues.error ?? couriers.error;
  if (failure) {
    console.error("[historial del pedido]", failure.message);
    return { ok: false, error: "No pudimos cargar el historial del pedido." };
  }
  const names = new Map((couriers.data ?? []).flatMap((row) => (row.id ? [[row.id, row.full_name ?? "el repartidor"] as const] : [])));

  const rows = evidence.data ?? [];
  const live = rows.filter((row) => row.file_path && !row.purged_at);
  const signed = live.length ? await supabase.storage.from("entregas").createSignedUrls(live.map((row) => row.file_path!), 300) : { data: [] };
  const urlByPath = new Map((signed.data ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])));

  const entries = buildTrace({
    events: events.data ?? [],
    offers: offers.data ?? [],
    evidence: rows,
    issues: issues.data ?? [],
    courierName: (id) => (id ? (names.get(id) ?? "el repartidor") : "el repartidor"),
    statusLabel: (status) => (status in orderStatusLabel ? orderStatusLabel[status as keyof typeof orderStatusLabel] : status),
  });
  const photos: TracePhoto[] = rows.flatMap((row) =>
    row.id && row.taken_at
      ? [{ id: row.id, kind: row.kind ?? "", label: photoLabels[row.kind ?? ""] ?? "Evidencia", takenAt: row.taken_at, url: row.file_path ? (urlByPath.get(row.file_path) ?? null) : null, purged: Boolean(row.purged_at), alert: row.flagged === true }]
      : [],
  );
  const cash: CashSummary | null =
    order.data?.payment_method === "efectivo"
      ? { method: "efectivo", total: Number(order.data.total ?? 0), collected: order.data.cash_collected === null ? null : Number(order.data.cash_collected), code: order.data.payment_ref, receivedAt: order.data.cash_received_at }
      : null;
  return { ok: true, entries, photos, cash };
}
