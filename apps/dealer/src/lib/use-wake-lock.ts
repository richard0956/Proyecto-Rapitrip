"use client";

import { useEffect } from "react";

/** ¿El navegador deja mantener la pantalla encendida? (Chrome en Android y Safari desde iOS 16.4 sí). */
export function wakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/**
 * Mantiene la pantalla encendida mientras `enabled` sea verdadero. El navegador suelta el bloqueo al salir de la app o apagar la
 * pantalla; al volver, se pide de nuevo. Sin soporte, no hace nada.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !wakeLockSupported()) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (cancelled || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) void lock.release();
      } catch {
        // Lo puede negar el ahorro de batería: la app sigue igual, solo que la pantalla se apaga sola.
      }
    };
    void request();
    document.addEventListener("visibilitychange", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      if (lock && !lock.released) void lock.release();
    };
  }, [enabled]);
}
