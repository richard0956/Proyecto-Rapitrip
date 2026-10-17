"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert, Button } from "@rapitrip/ui";
import Link from "next/link";
import { useState } from "react";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-[18px]">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.3-4 6.7-9.8 6.7-16.9z" />
      <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.6 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Ingreso con Google: Supabase devuelve al cliente a `/auth/callback`, que cierra el intercambio de sesión. */
export function GoogleButton({ next }: { next: string }) {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    setError(false);
    setBusy(true);
    const supabase = createBrowserSupabase();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (oauthError) {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" className="w-full border-borde-campo text-tinta hover:bg-calido" onClick={start} disabled={busy}>
        <GoogleMark />
        {busy ? "Conectando…" : "Continuar con Google"}
      </Button>
      <p className="text-center text-[12px] leading-snug text-tinta-suave">
        Al continuar aceptas los{" "}
        <Link href="/terminos" target="_blank" className="font-bold text-hoja underline-offset-2 hover:underline">
          términos
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" target="_blank" className="font-bold text-hoja underline-offset-2 hover:underline">
          política de privacidad
        </Link>
        .
      </p>
      {error ? <Alert tone="error">No pudimos iniciar con Google. Inténtalo de nuevo o usa tu correo.</Alert> : null}
    </div>
  );
}
