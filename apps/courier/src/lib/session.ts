import { redirect } from "next/navigation";
import { claimsHaveCourierRole } from "./claims";
import { serverSupabase } from "./supabase";

export type CourierSession = { userId: string; email: string | null };

/** Comprueba la sesión en el servidor; la base de datos vuelve a comprobar rol, ficha y vigencia en cada llamada. */
export async function requireCourier(): Promise<CourierSession> {
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (!claims || typeof claims.sub !== "string") redirect("/ingresar");
  if (!claimsHaveCourierRole(claims)) redirect("/ingresar?sin-acceso=1");
  return { userId: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
