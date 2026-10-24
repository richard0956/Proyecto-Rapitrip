"use server";

import { courierSchema, emailSchema, reasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { invokeFunction } from "@/lib/functions";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const formSchema = courierSchema.omit({ document_path: true });

export async function createCourier(input: unknown): Promise<ActionResult> {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("create_courier", {
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone,
    p_vehicle_type: parsed.data.vehicle_type,
  });
  if (error) return failure(error);
  revalidatePath("/admin/repartidores");
  return { ok: true };
}

export async function updateCourier(input: unknown): Promise<ActionResult> {
  const parsed = formSchema.extend({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("update_courier", {
    p_id: parsed.data.id,
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone,
    p_vehicle_type: parsed.data.vehicle_type,
  });
  if (error) return failure(error);
  revalidatePath("/admin/repartidores");
  return { ok: true };
}

/** Variante pensada para llamarse desde el cliente con el id como primer argumento. */
export async function updateCourierById(id: string, values: unknown): Promise<ActionResult> {
  return updateCourier({ ...(values as object), id });
}

export async function setCourierStatus(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["activo", "inactivo"]), reason: reasonSchema }).safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_courier_status", { p_id: parsed.data.id, p_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/admin/repartidores");
  return { ok: true };
}

/** El enlace firmado dura 60 segundos y la lectura queda auditada en el backend. */
export async function courierDocumentUrl(input: unknown): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: invalidInput.ok ? "" : invalidInput.error };
  await requireConsoleAccess("admin");
  const result = await invokeFunction<{ url: string }>("courier-document-url", { courier_id: parsed.data.id });
  return result.ok ? { ok: true, url: result.data.url } : result;
}

/** Invita al repartidor desde su ficha. La función de borde valida rol, sesión de consola y que la ficha esté activa y sin cuenta. */
export async function inviteCourier(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escribe un correo válido." };
  await requireConsoleAccess("admin");
  const result = await invokeFunction("invite-courier", { courier_id: parsed.data.id, email: parsed.data.email });
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath(`/admin/repartidores/${parsed.data.id}`);
  return { ok: true, message: "Invitación enviada." };
}

/** Quita el acceso del repartidor: revoca el rol, suelta la ficha y cierra sus sesiones al instante. */
export async function revokeCourierAccount(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), reason: reasonSchema }).safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("revoke_courier_account", { p_courier: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath(`/admin/repartidores/${parsed.data.id}`);
  revalidatePath("/admin/repartidores");
  return { ok: true };
}
