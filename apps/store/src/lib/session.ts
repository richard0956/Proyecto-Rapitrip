import { getSessionInfo } from "@rapitrip/supabase";
import { redirect } from "next/navigation";
import { serverSupabase } from "./supabase";

/** Vuelve a leer la sesión del servidor en cada carga protegida; el proxy no es la única comprobación. */
export async function requireCustomer(next: string) {
  const session = await getSessionInfo(await serverSupabase());
  if (!session.signedIn) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  return session;
}
