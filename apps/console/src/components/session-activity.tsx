"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SESSION_INACTIVITY_MINUTES } from "@/lib/session-config";

const INACTIVITY_MS = SESSION_INACTIVITY_MINUTES * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const events = ["pointerdown", "keydown", "scroll", "visibilitychange"] as const;

/** Latido `touch_session` mientras hay interacción y cierre local por inactividad. */
export function SessionActivity() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let lastActivity = Date.now();
    let lastBeat = Date.now();
    // Latido inmediato: la actividad registrada en la base puede haber vencido (por ejemplo, tras recargar una pestaña dormida).
    void supabase.rpc("touch_session").then(({ error }) => {
      if (error) router.replace("/sesion-expirada");
    });
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
