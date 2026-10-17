"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id?: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("No se pudo cargar Turnstile"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type TurnstileProps = {
  /** Sin clave no se muestra nada (entornos sin CAPTCHA). El servidor de Auth valida el token. */
  siteKey: string | undefined;
  onToken: (token: string | null) => void;
  /** Cambiar este número vuelve a dibujar el desafío (por ejemplo, tras un intento fallido). */
  resetKey?: number;
};

export function Turnstile({ siteKey, onToken, resetKey = 0 }: TurnstileProps) {
  const host = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let widget: string | undefined;
    loadScript()
      .then(() => {
        if (cancelled || !host.current || !window.turnstile) return;
        widget = window.turnstile.render(host.current, {
          sitekey: siteKey,
          language: "es",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widget) window.turnstile?.remove(widget);
    };
  }, [siteKey, resetKey]);

  if (!siteKey) return null;
  return <div ref={host} />;
}
