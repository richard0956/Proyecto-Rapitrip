"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { invokeFunction } from "@/lib/functions";
import { requireConsoleAccess } from "@/lib/guard";
import { loadOrderTrace, type TraceResult } from "@/lib/order-trace-server";
import { toRoutePoints, type RouteResult } from "@/lib/order-route";
import { serverSupabase } from "@/lib/supabase";

function refresh() {
  revalidatePath("/coordinacion");
}

/** Despachar, entregar o cancelar. La base de datos decide si ese cambio le toca a coordinación y exige repartidor para despachar. */
export async function setOrderStatus(id: string, input: { to: string; reason?: string }): Promise<ActionResult> {
  const parsed = z
    .object({ id: z.string().uuid(), to: z.enum(["en_camino", "entregado", "cancelado"]), reason: reasonSchema.optional() })
    .safeParse({ id, to: input.to, reason: input.reason?.trim() ? input.reason : undefined });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_order_status", { p_order: parsed.data.id, p_to: parsed.data.to, p_reason: parsed.data.reason });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function assignCourier(id: string, courierId: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), courier: z.string().uuid() }).safeParse({ id, courier: courierId });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("assign_order_courier", { p_order: parsed.data.id, p_courier: parsed.data.courier });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

/** Pasa a programado un pedido express que no cabe en una moto. Quita al repartidor asignado; la base de datos exige motivo y que aún no haya salido. */
export async function reclassifyOrder(id: string, reason: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), reason: reasonSchema }).safeParse({ id, reason });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("reclassify_order", { p_order: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

/** Puntos de la ruta (tienda y destino) de un pedido. La base de datos solo los entrega a coordinación y administración. */
export async function orderRoute(id: string): Promise<RouteResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("order_route_points", { p_order: parsed.data });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: "No pudimos cargar la ruta." };
  return { ok: true, points: toRoutePoints(row) };
}

/** A quién se le puede proponer el pedido ahora: disponibles, con cuenta, compatibles y sin otra propuesta abierta. */
export async function offerableCouriers(orderId: string): Promise<{ ok: true; couriers: { id: string; name: string; vehicleClass: string | null; department: string | null; activeOrders: number }[] } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(orderId);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("offerable_couriers", { p_order: parsed.data });
  if (error) {
    console.error("[offerable_couriers]", error.message);
    return { ok: false, error: "No pudimos buscar repartidores disponibles." };
  }
  return { ok: true, couriers: (data ?? []).map((row) => ({ id: row.courier_id, name: row.full_name, vehicleClass: row.vehicle_class, department: row.department, activeOrders: Number(row.active_orders) })) };
}

/** Pide a `send-push` que vacíe la cola ya. Si falla no importa: el programador la recoge cada minuto. */
async function kickPush() {
  try {
    await invokeFunction("send-push", {});
  } catch {
    // La propuesta ya quedó guardada; el aviso saldrá en la siguiente pasada.
  }
}

/**
 * Propone el pedido a un repartidor y pide que el aviso salga ya (el programador también lo recoge cada minuto, así que si este
 * disparo falla la propuesta no se pierde: solo tarda un poco más en sonar).
 */
export async function offerOrder(orderId: string, courierId: string): Promise<ActionResult> {
  const parsed = z.object({ order: z.string().uuid(), courier: z.string().uuid() }).safeParse({ order: orderId, courier: courierId });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("offer_order_to_courier", { p_order: parsed.data.order, p_courier: parsed.data.courier });
  if (error) return failure(error);
  await kickPush();
  refresh();
  return { ok: true };
}

export async function cancelOffer(offerId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(offerId);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("cancel_order_offer", { p_offer: parsed.data });
  if (error) return failure(error);
  await kickPush();
  refresh();
  return { ok: true };
}

export async function resolveIssue(issueId: string, note: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), note: z.string().trim().min(3).max(200) }).safeParse({ id: issueId, note });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("resolve_delivery_issue", { p_issue: parsed.data.id, p_note: parsed.data.note });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

export async function resetCode(orderId: string, kind: "recogida" | "entrega", reason: string): Promise<ActionResult> {
  const parsed = z.object({ order: z.string().uuid(), kind: z.enum(["recogida", "entrega"]), reason: reasonSchema }).safeParse({ order: orderId, kind, reason });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("reset_order_code_attempts", { p_order: parsed.data.order, p_kind: parsed.data.kind, p_reason: parsed.data.reason });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

/** Historial, evidencias y cobro de un pedido, con las fotos firmadas por 5 minutos. */
export async function orderTrace(orderId: string): Promise<TraceResult> {
  const parsed = z.string().uuid().safeParse(orderId);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  await requireConsoleAccess("coordinacion");
  return loadOrderTrace(await serverSupabase(), parsed.data);
}
