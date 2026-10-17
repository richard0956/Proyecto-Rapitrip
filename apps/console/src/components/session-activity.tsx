"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Debe coincidir con `[auth.sessions] inactivity_timeout` de supabase/config.toml. */
const INACTIVITY_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const events = ["pointerdown", "keydown", "scroll", "visibilitychange"] as const;

/** Latido `touch_session` mientras hay interacción y cierre local por inactividad. */
export function SessionActivity() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let lastActivity = Date.now();
    let lastBeat = 0;
    const mark = () => {
      lastActivity = Date.now();
    };
    events.forEach((name) => window.addEventListener(name, mark, { passive: true }));

    const tick = window.setInterval(async () => {
      const idle = Date.now() - lastActivity;
      if (idle >= INACTIVITY_MS) {
        await supabase.auth.signOut();
        router.replace("/sesion-expirada");
        return;
      }
      if (idle < HEARTBEAT_MS && Date.now() - lastBeat >= HEARTBEAT_MS) {
        lastBeat = Date.now();
        const { error } = await supabase.rpc("touch_session");
        if (error) router.replace("/sesion-expirada");
      }
    }, 15_000);

    return () => {
      window.clearInterval(tick);
      events.forEach((name) => window.removeEventListener(name, mark));
    };
  }, [router]);

  return null;
}
