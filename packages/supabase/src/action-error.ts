export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

type RpcError = { code?: string | null; message?: string | null };

const generic = "No se pudo completar la acción. Inténtalo de nuevo.";
/** Códigos con los que las funciones de la base de datos devuelven mensajes pensados para el usuario. */
const friendlyCodes = new Set(["42501", "22023", "P0002", "23505", "28000"]);

export function failure(error: RpcError | null | undefined): ActionResult {
  if (error?.code && friendlyCodes.has(error.code) && error.message) return { ok: false, error: error.message };
  console.error("[acción de consola]", error?.code, error?.message);
  return { ok: false, error: generic };
}

/** La sesión del cliente (tope de 1 día) venció: la interfaz debe llevarlo a ingresar de nuevo sin perder lo escrito. */
export function isSessionExpired(error: RpcError | null | undefined): boolean {
  return error?.code === "42501" && /venci/i.test(error.message ?? "");
}

export const invalidInput: ActionResult = { ok: false, error: "Revisa los datos e inténtalo de nuevo." };
