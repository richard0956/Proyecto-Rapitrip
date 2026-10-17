"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert, Button, buttonStyles, Field } from "@rapitrip/ui";
import { emailSchema, fullNameSchema, passwordSchema } from "@rapitrip/validation";
import { Lock, Mail, MailCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { Turnstile } from "@/components/turnstile";
import { LEGAL_VERSION } from "@/lib/legal";

type Errors = Partial<Record<"name" | "email" | "password" | "confirm" | "terms", string>>;

export function SignupForm({ next }: { next: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const onToken = useCallback((value: string | null) => setToken(value), []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = {
      name: fullNameSchema.safeParse(name),
      email: emailSchema.safeParse(email),
      password: passwordSchema.safeParse(password),
    };
    const next_errors: Errors = {};
    if (!parsed.name.success) next_errors.name = "Escribe tu nombre (mínimo 2 letras).";
    if (!parsed.email.success) next_errors.email = "Escribe un correo válido.";
    if (!parsed.password.success) next_errors.password = "La contraseña debe tener entre 8 y 72 caracteres.";
    else if (password !== confirm) next_errors.confirm = "Las contraseñas no coinciden.";
    if (!accepted) next_errors.terms = "Acepta los términos y la política de privacidad para crear tu cuenta.";
    setErrors(next_errors);
    if (Object.keys(next_errors).length > 0 || !parsed.name.success || !parsed.email.success || !parsed.password.success) return;
    if (captchaRequired && !token) return setError("Completa la verificación de seguridad.");

    setBusy(true);
    const supabase = createBrowserSupabase();
    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.email.data,
      password,
      options: {
        data: { full_name: parsed.name.data, terms_version: LEGAL_VERSION, terms_accepted_at: new Date().toISOString() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        captchaToken: token ?? undefined,
      },
    });
    setBusy(false);
    if (signUpError) {
      setError("No pudimos crear la cuenta. Revisa tus datos e inténtalo de nuevo.");
      setToken(null);
      setResetKey((n) => n + 1);
      return;
    }
    // Respuesta idéntica exista o no el correo: no se revela si ya hay una cuenta.
    setSentTo(parsed.email.data);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <Alert icon={<MailCheck className="size-[18px]" />}>
          Si <strong>{sentTo}</strong> no tenía cuenta, te enviamos un enlace para confirmarla. Revisa también la carpeta de correo no deseado.
        </Alert>
        <Link href="/ingresar" className={buttonStyles({ variant: "primary" })}>
          Ir a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Nombre completo" icon={<UserRound className="size-4" />} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
      <Field label="Correo" icon={<Mail className="size-4" />} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
      <Field label="Contraseña" icon={<Lock className="size-4" />} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Entre 8 y 72 caracteres." required />
      <Field label="Repite la contraseña" icon={<Lock className="size-4" />} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} required />
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 text-[13.5px] leading-snug text-tinta">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            aria-invalid={errors.terms ? true : undefined}
            aria-describedby={errors.terms ? "terms-error" : undefined}
            className="mt-0.5 size-[18px] shrink-0 accent-hoja"
          />
          <span>
            Acepto los{" "}
            <Link href="/terminos" target="_blank" className="font-bold text-hoja underline-offset-2 hover:underline">
              términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" target="_blank" className="font-bold text-hoja underline-offset-2 hover:underline">
              política de privacidad
            </Link>
            .
          </span>
        </label>
        {errors.terms ? (
          <p id="terms-error" className="text-[12.5px] font-semibold text-rojo">
            {errors.terms}
          </p>
        ) : null}
      </div>
      <Turnstile onToken={onToken} resetKey={resetKey} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="w-full" disabled={busy || !name || !email || !password || !confirm}>
        {busy ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
