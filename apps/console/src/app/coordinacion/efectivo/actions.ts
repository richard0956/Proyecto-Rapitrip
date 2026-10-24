"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

export type RegisterCashResult = { ok: true; code: string } | { ok: false; error: string };

/** Registra el efectivo de un pedido entregado por un repartidor SIN cuenta. Quien usa la aplicación lo registra él mismo al entregar. */
export async function registerCourierCash(orderId: string): Promise<RegisterCashResult> {
  const parsed = z.string().uuid().safeParse(orderId);
  if (!parsed.success) return { ok: false, error: "pedido inválido" };
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("register_courier_cash", { p_order: parsed.data });
  if (error) return failure(error) as { ok: false; error: string };
  revalidatePath("/coordinacion/efectivo");
  return { ok: true, code: String(data) };
}
