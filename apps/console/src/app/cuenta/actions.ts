"use server";

import { fullNameSchema, passwordSchema, phoneSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, type ActionResult } from "@/lib/action-error";
import { requireAnyConsoleSession } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const schema = z.object({ fullName: fullNameSchema, phone: z.union([phoneSchema, z.literal("")]) });

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireAnyConsoleSession();
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: parsed.data.fullName,
    // La función acepta null para borrar el teléfono; los tipos generados no marcan el argumento como nulo.
    p_phone: (parsed.data.phone || null) as string,
  });
  if (error) return failure(error);
  revalidatePath("/", "layout");
  return { ok: true, message: "Datos guardados." };
}

const avatarSchema = z.object({ path: z.string().regex(/^[0-9a-f-]{36}\/[A-Za-z0-9_.-]{1,80}$/).nullable(), previous: z.string().nullable().optional() });

/**
 * Registra la foto ya subida (o la quita con `path: null`) y borra la anterior. La subida la hace el navegador directo al
 * almacenamiento, en la carpeta de la propia cuenta; la base de datos solo acepta rutas de esa carpeta.
 */
export async function saveAvatar(input: unknown): Promise<ActionResult> {
  const parsed = avatarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "No pudimos guardar la foto." };
  await requireAnyConsoleSession();
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_my_avatar", { p_path: parsed.data.path as string });
  if (error) return failure(error);
  // La foto anterior ya no se usa: se borra (si falla, solo queda un archivo huérfano en la carpeta de la propia cuenta).
  if (parsed.data.previous && parsed.data.previous !== parsed.data.path) await supabase.storage.from("avatars").remove([parsed.data.previous]);
  revalidatePath("/", "layout");
  return { ok: true, message: parsed.data.path ? "Foto actualizada." : "Quitamos tu foto." };
}

export async function setOrderEmails(enabled: boolean): Promise<ActionResult> {
  await requireAnyConsoleSession();
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_my_notifications", { p_order_email: enabled === true });
  if (error) return failure(error);
  revalidatePath("/cuenta/preferencias");
  return { ok: true, message: enabled ? "Te avisaremos por correo." : "Ya no te enviaremos esos correos." };
}

/** Resultado del cambio de contraseña. `needsCode`: Supabase pide confirmar con el código que manda al correo. */
export type PasswordResult = { ok: true } | { ok: false; error: string; needsCode?: boolean };

const passwordInput = z.object({ password: passwordSchema, code: z.string().trim().regex(/^\d{6}$/).optional() });

/**
 * Cambio de contraseña desde la consola: solo dirección y administración. El resto de las cuentas del equipo la restablece la
 * administración. Con `secure_password_change`, Supabase pide el código que envía al correo si el ingreso no es reciente.
 */
export async function changePassword(input: unknown): Promise<PasswordResult> {
  const parsed = passwordInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "La contraseña no cumple los requisitos." };
  const session = await requireAnyConsoleSession();
  if (session.area !== "admin") return { ok: false, error: "Tu contraseña la restablece la administración." };
  const supabase = await serverSupabase();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password, ...(parsed.data.code ? { nonce: parsed.data.code } : {}) });
  if (!error) return { ok: true };
  if (error.code === "reauthentication_needed") return { ok: false, needsCode: true, error: "Por seguridad, confirma el cambio con el código que te enviamos al correo." };
  if (error.code === "reauthentication_not_valid") return { ok: false, needsCode: true, error: "El código no es válido o ya venció. Pide uno nuevo." };
  if (error.code === "same_password") return { ok: false, error: "La contraseña nueva debe ser distinta de la actual." };
  if (error.code === "weak_password") return { ok: false, error: "Esa contraseña es muy fácil de adivinar. Prueba con una más larga." };
  console.error("[cuenta] cambio de contraseña", error.code, error.message);
  return { ok: false, error: "No pudimos cambiar la contraseña. Inténtalo de nuevo en unos minutos." };
}

/** Envía al correo de la cuenta el código de 6 dígitos que confirma el cambio de contraseña. */
export async function reauthenticateForPassword(): Promise<PasswordResult> {
  const session = await requireAnyConsoleSession();
  if (session.area !== "admin") return { ok: false, error: "Tu contraseña la restablece la administración." };
  const supabase = await serverSupabase();
  const { error } = await supabase.auth.reauthenticate();
  if (!error) return { ok: true };
  console.error("[cuenta] código de reautenticación", error.code, error.message);
  return { ok: false, error: "No pudimos enviar el código. Espera un momento e inténtalo otra vez." };
}

/** Cierra la sesión en todos los dispositivos donde se ingresó con esta cuenta (incluido este). */
export async function signOutEverywhere() {
  const supabase = await serverSupabase();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
