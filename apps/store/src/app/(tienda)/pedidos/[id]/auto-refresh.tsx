"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Mantiene la pantalla al día: vuelve a pedir los datos al servidor cada `everyMs` mientras la pestaña esté visible y,
 * si `maxAttempts` está definido, deja de insistir tras esos intentos (la confirmación del pago).
 */
export function AutoRefresh({ everyMs, maxAttempts, onExhausted }: { everyMs: number; maxAttempts?: number; onExhausted?: () => void }) {
  const router = useRouter();
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      attempts++;
      router.refresh();
      if (maxAttempts !== undefined && attempts >= maxAttempts) {
        clearInterval(timer);
        onExhausted?.();
      }
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs, maxAttempts, onExhausted]);
  return null;
}
