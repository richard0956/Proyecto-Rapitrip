"use client";

import { getSessionInfo, homePathForRole, requiresMfa } from "@rapitrip/supabase";
import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { emailSchema } from "@rapitrip/validation";
import { Alert, Button, Field } from "@rapitrip/ui";
import { Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { Turnstile } from "@/components/turnstile";

const genericError = "No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data,
      password,
      options: token ? { captchaToken: token } : undefined,
    });
    if (signInError) {
      setError(genericError);
      setToken(null);
      setResetKey((n) => n + 1);
      setBusy(false);
      return;
    }
    const session = await getSessionInfo(supabase);
    router.replace(requiresMfa(session.role) ? "/mfa" : homePathForRole(session.role));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Correo" icon={<Mail className="size-4" />} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError ?? undefined} required />
      <Field label="Contraseña" icon={<Lock className="size-4" />} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Turnstile onToken={onToken} resetKey={resetKey} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="w-full" disabled={busy || !email || !password}>
        {busy ? "Ingresando…" : "Ingresar a la consola"}
      </Button>
    </form>
  );
}
