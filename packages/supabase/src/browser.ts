import type { Database } from "@rapitrip/db-types";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "./env";

export function createBrowserSupabase() {
  const { url, anonKey } = publicEnv();
  return createBrowserClient<Database>(url, anonKey);
}
