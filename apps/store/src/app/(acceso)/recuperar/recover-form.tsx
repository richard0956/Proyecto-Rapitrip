"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert, Button, Field } from "@rapitrip/ui";
import { emailSchema } from "@rapitrip/validation";
import { Mail, MailCheck } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { Turnstile } from "@/components/turnstile";

export function RecoverForm() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const onToken = useCallback((value: string | null) => setToken(value), []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setFieldError("Escribe un correo válido.");
    setFieldError(null);
    if (captchaRequired && !token) return setError("Completa la verificación de seguridad.");

    setBusy(true);
    const supabase = createBrowserSupabase();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/recuperar/nueva")}`,
      captchaToken: token ?? undefined,
    });
    setBusy(false);
    if (resetError && resetError.status !== 400 && resetError.status !== 404) {
      setError("No pudimos enviar el enlace. Inténtalo de nuevo en unos minutos.");
      setToken(null);
      setResetKey((n) => n + 1);
      return;
    }
    // Respuesta idéntica exista o no la cuenta.
    setSent(true);
  }

  if (sent) {
    return <Alert icon={<MailCheck className="size-[18px]" />}>Si hay una cuenta con ese correo, te enviamos un enlace para elegir una contraseña nueva. Vence en una hora.</Alert>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Correo" icon={<Mail className="size-4" />} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError ?? undefined} required />
      <Turnstile onToken={onToken} resetKey={resetKey} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="w-full" disabled={busy || !email}>
        {busy ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
