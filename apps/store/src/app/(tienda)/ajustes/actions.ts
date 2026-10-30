"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { emailSchema, fullNameSchema, phoneSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { siteUrl } from "@/lib/site-url";
import { serverSupabase } from "@/lib/supabase";

const schema = z.object({ fullName: fullNameSchema, phone: z.union([phoneSchema, z.literal("")]) });

export async function updateProfile(input: unknown): Promise<CustomerResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireCustomer("/ajustes");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: parsed.data.fullName,
    // La función acepta null para borrar el teléfono; los tipos generados no marcan el argumento como nulo.
    p_phone: (parsed.data.phone || null) as string,
  });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath("/ajustes");
  return { ok: true, message: "Datos guardados." };
}

const avatarSchema = z.object({ path: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9_.-]{1,80}$/).nullable(), previous: z.string().nullable().optional() });

/**
 * Registra la foto ya subida (o la quita con `path: null`) y borra la anterior del bucket. La subida la hace el navegador
 * directo al almacenamiento, en la carpeta del cliente; la base de datos solo acepta rutas de esa carpeta.
 */
export async function saveAvatar(input: unknown): Promise<CustomerResult> {
  const parsed = avatarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "No pudimos guardar la foto." };
  await requireCustomer("/ajustes");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_my_avatar", { p_path: parsed.data.path as string });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  // La foto anterior ya no se usa: se borra (si falla, solo queda un archivo huérfano en la carpeta del propio cliente).
  if (parsed.data.previous && parsed.data.previous !== parsed.data.path) await supabase.storage.from("avatars").remove([parsed.data.previous]);
  revalidatePath("/", "layout");
  return { ok: true, message: parsed.data.path ? "Foto actualizada." : "Quitamos tu foto." };
}

/**
 * Pide el cambio de correo. Supabase manda un enlace al correo actual y otro al nuevo (`double_confirm_changes`); el cambio se
 * aplica al confirmar los dos, y un disparador de la base copia el correo nuevo al perfil.
 */
export async function changeEmail(input: unknown): Promise<CustomerResult> {
  const parsed = z.object({ email: emailSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escribe un correo válido." };
  await requireCustomer("/ajustes");
  const supabase = await serverSupabase();
  const { data: current } = await supabase.auth.getUser();
  if (current.user?.email?.toLowerCase() === parsed.data.email.toLowerCase()) return { ok: false, error: "Ese ya es el correo de tu cuenta." };
  const { error } = await supabase.auth.updateUser({ email: parsed.data.email }, { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent("/ajustes")}` });
  if (error?.code === "email_exists") return { ok: false, error: "Ese correo ya pertenece a otra cuenta." };
  if (error?.code === "over_email_send_rate_limit") return { ok: false, error: "Pediste varios cambios seguidos. Espera unos minutos e inténtalo de nuevo." };
  if (error) {
    console.error("[ajustes] cambio de correo", error.code, error.message);
    return { ok: false, error: "No pudimos pedir el cambio de correo. Inténtalo de nuevo en unos minutos." };
  }
  return { ok: true, message: `Te enviamos un enlace a ${parsed.data.email} y otro a tu correo actual. El cambio se aplica cuando confirmes los dos.` };
}
