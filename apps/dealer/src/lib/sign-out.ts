import { getSupabase } from "./client";
import { disablePush } from "./push-client";

/**
 * Cierra la sesión del repartidor. Antes, este teléfono deja de recibir los avisos de la cuenta (si otra persona lo usa, no los
 * recibirá). `global` la cierra también en todos los otros teléfonos donde se ingresó.
 */
export async function signOutCourier(scope: "local" | "global" = "local") {
  await disablePush();
  await getSupabase().auth.signOut({ scope });
}
