import { decideConsoleAccess, getSessionInfo, type ConsoleArea } from "@rapitrip/supabase";
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
