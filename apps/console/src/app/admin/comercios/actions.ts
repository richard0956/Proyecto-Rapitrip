"use server";

import { reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { invokeFunction } from "@/lib/functions";
import { serverSupabase } from "@/lib/supabase";

/** Suspender o reactivar un comercio completo. La base de datos exige motivo, sesión de consola y permiso sobre comercios. */
export async function setCommerceStatus(id: string, input: { status: "activo" | "suspendido"; reason: string }): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["activo", "suspendido"]), reason: reasonSchema }).safeParse({ id, ...input });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_commerce_status", { p_commerce: parsed.data.id, p_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/admin/comercios");
  revalidatePath("/admin/vendedores");
  revalidatePath(`/admin/comercios/${parsed.data.id}`);
  return { ok: true };
}

/** Invita (o reinvita) la cuenta de consola del comercio: la Edge Function genera el enlace y lo envía al correo. */
export async function inviteCommerceAccount(id: string, email: string): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), email: z.string().trim().toLowerCase().email().max(254) }).safeParse({ id, email });
  if (!parsed.success) return { ok: false, error: "Escribe un correo válido." };
  await requireConsoleAccess("admin");
  const result = await invokeFunction<{ email: string }>("invite-commerce", { commerce_id: parsed.data.id, email: parsed.data.email });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/admin/comercios/${parsed.data.id}`);
  return { ok: true, message: `Enviamos la invitación a ${result.data.email}. Vence en 4 días.` };
}
