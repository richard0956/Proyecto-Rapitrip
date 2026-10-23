"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { loadOrderTrace, type TraceResult } from "@/lib/order-trace-server";
import { toRoutePoints, type RouteResult } from "@/lib/order-route";
import { serverSupabase } from "@/lib/supabase";

/** Cancelar un pedido abierto como excepción. La base de datos exige motivo, devuelve el stock y encola el reembolso si estaba pagado con tarjeta. */
export async function cancelOrder(id: string, reason: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), reason: reasonSchema }).safeParse({ id, reason });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_order_status", { p_order: parsed.data.id, p_to: "cancelado", p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/excepciones");
  return { ok: true };
}

/** Puntos de la ruta (tienda y destino) de un pedido. La base de datos solo los entrega a coordinación y administración. */
export async function orderRoute(id: string): Promise<RouteResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("order_route_points", { p_order: parsed.data });
  const row = data?.[0];
  if (error || !row) return { ok: false, error: "No pudimos cargar la ruta." };
  return { ok: true, points: toRoutePoints(row) };
}

/** Historial, evidencias y cobro de un pedido, con las fotos firmadas por 5 minutos. */
export async function orderTrace(id: string): Promise<TraceResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Pedido inválido." };
  await requireConsoleAccess("admin");
  return loadOrderTrace(await serverSupabase(), parsed.data);
}
