import type { Database } from "@rapitrip/db-types";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "./env";

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
};

/** El llamador pasa el adaptador de cookies de Next (`cookies()`), que este paquete no importa. */
export function createServerSupabase(cookies: CookieAdapter) {
  const { url, anonKey } = publicEnv();
  return createServerClient<Database>(url, anonKey, { cookies });
}
