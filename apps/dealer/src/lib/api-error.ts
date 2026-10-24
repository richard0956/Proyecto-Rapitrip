type RpcError = { code?: string | null; message?: string | null } | null | undefined;

const offline = "Sin conexión. Revisa tu señal e inténtalo de nuevo.";

/** El mensaje de la base de datos ya está pensado para quien usa la app; se muestra tal cual salvo en errores de red o de sesión. */
export function friendlyError(error: RpcError, fallback = "No pudimos completar la acción. Inténtalo de nuevo."): string {
  if (!error) return fallback;
  const message = error.message ?? "";
  if (!error.code && /fetch|network|load failed|timeout/i.test(message)) return offline;
  if (error.code === "42501" || error.code === "28000") return "Tu sesión venció o ya no tienes permiso. Ingresa de nuevo.";
  if (error.code === "P0002") return message || "No encontramos ese pedido.";
  if (error.code === "22023" || error.code === "23505") return message || fallback;
  return fallback;
}

/** La sesión terminó o el rol ya no sirve: la aplicación debe llevar al ingreso. */
export function isAuthError(error: RpcError): boolean {
  return error?.code === "42501" || error?.code === "28000";
}
