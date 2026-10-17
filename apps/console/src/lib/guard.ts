import { areaForRole, decideConsoleAccess, getSessionInfo, type ConsoleArea } from "@rapitrip/supabase";
import { redirect } from "next/navigation";
import { serverSupabase } from "./supabase";

/** Vuelve a leer sesión y rol del servidor en cada carga protegida; el proxy no es la única comprobación. */
export async function requireConsoleAccess(area: ConsoleArea) {
  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  const decision = decideConsoleAccess({ ...session, area });
  if (decision.kind === "redirect") redirect(decision.to);
  return session;
}

/** Para pantallas comunes a todos los roles de consola (por ejemplo, Mi cuenta). */
export async function requireAnyConsoleSession() {
  const session = await getSessionInfo(await serverSupabase());
  const area = areaForRole(session.role);
  if (!area) return redirect(session.signedIn ? "/sin-acceso" : "/login");
  return { ...(await requireConsoleAccess(area)), area };
}
