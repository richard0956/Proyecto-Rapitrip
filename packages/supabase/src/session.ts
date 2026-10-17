import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@rapitrip/validation";
import { roleFromClaims } from "./roles";

export type SessionInfo = {
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  role: AppRole | null;
  aal: "aal1" | "aal2" | null;
};

const anonymous: SessionInfo = { signedIn: false, userId: null, email: null, role: null, aal: null };

/** Verifica el JWT (no solo lo decodifica) y extrae rol y nivel de aseguramiento. */
export async function getSessionInfo(supabase: SupabaseClient<any, any, any>): Promise<SessionInfo> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (error || !claims || typeof claims.sub !== "string") return anonymous;
  return {
    signedIn: true,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    role: roleFromClaims(claims),
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
}
