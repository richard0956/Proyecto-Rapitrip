/** La clave pública VAPID viaja en base64url; el navegador la pide como bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: "no-soportado" | "instalar-ios" | "sin-clave" };

/**
 * Qué falta para activar los avisos. En iPhone, Apple solo permite push si la aplicación está en la pantalla de inicio
 * (modo standalone); en Android y escritorio basta con aceptar el permiso.
 */
export function pushSupport(env: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  isIos: boolean;
  isStandalone: boolean;
  hasKey: boolean;
}): PushSupport {
  if (env.isIos && !env.isStandalone) return { ok: false, reason: "instalar-ios" };
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return { ok: false, reason: "no-soportado" };
  if (!env.hasKey) return { ok: false, reason: "sin-clave" };
  return { ok: true };
}

export function detectEnvironment(): Parameters<typeof pushSupport>[0] {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return {
    hasServiceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    hasPushManager: typeof window !== "undefined" && "PushManager" in window,
    hasNotification: typeof window !== "undefined" && "Notification" in window,
    isIos: /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document),
    isStandalone: Boolean(standalone),
    hasKey: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
  };
}
