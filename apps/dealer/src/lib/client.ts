"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";

let instance: ReturnType<typeof createBrowserSupabase> | null = null;

/** Un solo cliente por pestaña: comparte la sesión y evita abrir varias conexiones. */
export function getSupabase() {
  instance ??= createBrowserSupabase();
  return instance;
}

export type Supabase = ReturnType<typeof getSupabase>;
