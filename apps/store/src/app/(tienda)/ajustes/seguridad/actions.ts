"use server";

import { passwordSchema } from "@rapitrip/validation";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

/** Resultado del cambio de contraseña. `needsCode`: Supabase pide confirmar con el código que manda al correo. */
export type PasswordResult = { ok: true } | { ok: false; error: string; needsCode?: boolean };

const schema = z.object({ password: passwordSchema, code: z.string().trim().regex(/^\d{6}$/).optional() });

/**
 * Cambia la contraseña de la cuenta. Con `secure_password_change`, Supabase solo la cambia sin más si el ingreso es reciente;
 * si no, pide el código de reautenticación (`reauthenticateForPassword`) y se vuelve a llamar con él.
 */
export async function changePassword(input: unknown): Promise<PasswordResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "La contraseña debe tener entre 8 y 72 caracteres." };
  await requireCustomer("/ajustes/seguridad");
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
  await requireCustomer("/ajustes/seguridad");
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
  redirect("/ingresar");
}
