"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

type Props = { onToken: (token: string | null) => void; resetKey?: number };

/** Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no se muestra (entornos sin CAPTCHA). El servidor de Auth valida el token. */
export function Turnstile({ onToken, resetKey = 0 }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !host.current || !window.turnstile) return;
      if (widget.current) window.turnstile.remove(widget.current);
      widget.current = window.turnstile.render(host.current, {
        sitekey: siteKey,
        language: "es",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };
    if (window.turnstile) mount();
    else window.addEventListener("turnstile-ready", mount, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("turnstile-ready", mount);
      if (widget.current) window.turnstile?.remove(widget.current);
    };
  }, [siteKey, resetKey, onToken]);

  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => {
          window.dispatchEvent(new Event("turnstile-ready"));
        }}
      />
      <div ref={host} />
    </>
  );
}
