/** Resultado del cambio de contraseña. `needsCode`: Supabase pide confirmar con el código que manda al correo. */
export type PasswordResult = { ok: true } | { ok: false; error: string; needsCode?: boolean };

/**
 * Traduce la respuesta de `auth.updateUser({ password })`. Con `secure_password_change`, Supabase solo cambia la contraseña sin
 * más si el ingreso es reciente; si no, pide el código de reautenticación. Mismos mensajes que la tienda.
 */
export function passwordResult(error: { code?: string; message?: string } | null): PasswordResult {
  if (!error) return { ok: true };
  if (error.code === "reauthentication_needed") return { ok: false, needsCode: true, error: "Por seguridad, confirma el cambio con el código que te enviamos al correo." };
  if (error.code === "reauthentication_not_valid") return { ok: false, needsCode: true, error: "El código no es válido o ya venció. Pide uno nuevo." };
  if (error.code === "same_password") return { ok: false, error: "La contraseña nueva debe ser distinta de la actual." };
  if (error.code === "weak_password") return { ok: false, error: "Esa contraseña es muy fácil de adivinar. Prueba con una más larga." };
  if (!error.code && /fetch|network/i.test(error.message ?? "")) return { ok: false, error: "Sin conexión. Revisa tu señal e inténtalo de nuevo." };
  return { ok: false, error: "No pudimos cambiar la contraseña. Inténtalo de nuevo en unos minutos." };
}
