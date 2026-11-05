"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { invokeFunction } from "@/lib/functions";
import { serverSupabase } from "@/lib/supabase";

/**
 * Aprobar crea el comercio e invita a su cuenta de consola (Zero Trust: un correo propio, nunca la cuenta de la tienda de quien
 * lo pidió). La Edge Function genera el enlace y lo envía; la base de datos valida permisos, convenio y correo.
 */
export async function approveRequest(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), convenio: z.literal(true), consoleEmail: z.string().trim().toLowerCase().email().max(254) }).safeParse(input);
  if (!parsed.success) {
    const convenio = (input as { convenio?: unknown } | null)?.convenio === true;
    return { ok: false, error: convenio ? "Escribe un correo válido para la cuenta de consola del comercio." : "Confirma que el convenio está firmado para aprobar." };
  }
  await requireConsoleAccess("admin");
  const result = await invokeFunction<{ email: string }>("invite-commerce", { request_id: parsed.data.id, console_email: parsed.data.consoleEmail });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin/solicitudes");
  revalidatePath("/admin/comercios");
  return { ok: true, message: `Comercio aprobado. Enviamos la invitación a ${result.data.email}.` };
}

export async function rejectRequest(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), reason: z.string().trim().min(10).max(500) }).safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("reject_commerce_request", { p_request: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/admin/solicitudes");
  return { ok: true };
}
