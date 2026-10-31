"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert, Button, buttonStyles, Field } from "@rapitrip/ui";
import { emailSchema, fullNameSchema, passwordProblem, passwordSchema } from "@rapitrip/validation";
import { KeyRound, Mail, MailCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { NewPasswordFields } from "@/components/new-password-fields";
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
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resent, setResent] = useState(false);
  const router = useRouter();
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
    if (!parsed.password.success) next_errors.password = passwordProblem(password) ?? "Escribe una contraseña válida.";
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
    // Si Auth avisa que el correo ya tiene cuenta, se le dice a la persona en el campo del correo.
    if (signUpError?.code === "user_already_exists") {
      setErrors({ email: "Este correo ya existe en el sistema. Ingresa con él o recupera tu contraseña." });
      setToken(null);
      setResetKey((n) => n + 1);
      return;
    }
    if (signUpError) {
      // El detalle va a la consola para poder diagnosticar (sin datos personales); la persona ve un texto que no la culpa si falló el servidor.
      console.error("[registro]", { status: signUpError.status, code: signUpError.code, message: signUpError.message });
      const tooMany = signUpError.status === 429 || signUpError.code === "over_email_send_rate_limit";
      setError(
        tooMany
          ? "Hiciste varios intentos seguidos. Espera unos minutos e inténtalo de nuevo."
          : signUpError.status && signUpError.status >= 500
            ? "No pudimos enviar el correo de confirmación en este momento. Inténtalo de nuevo en unos minutos."
            : "No pudimos crear la cuenta. Revisa tus datos e inténtalo de nuevo.",
      );
      setToken(null);
      setResetKey((n) => n + 1);
      return;
    }
    // Respuesta idéntica exista o no el correo: no se revela si ya hay una cuenta.
    setSentTo(parsed.email.data);
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    if (!sentTo) return;
    setCodeError(null);
    setResent(false);
    const digits = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(digits)) return setCodeError("Escribe los 6 dígitos del código.");
    setVerifying(true);
    const { error: verifyError } = await createBrowserSupabase().auth.verifyOtp({ email: sentTo, token: digits, type: "signup" });
    setVerifying(false);
    if (verifyError) return setCodeError("El código es incorrecto o ya venció. Revisa el correo o pide uno nuevo.");
    // El código confirma el correo y deja la sesión iniciada: se sigue a donde iba la persona.
    router.replace(next);
    router.refresh();
  }

  async function onResend() {
    if (!sentTo) return;
    setCodeError(null);
    setResent(false);
    const { error: resendError } = await createBrowserSupabase().auth.resend({
      type: "signup",
      email: sentTo,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (resendError) return setCodeError("No pudimos reenviar el código ahora. Inténtalo de nuevo en unos minutos.");
    setResent(true);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <Alert icon={<MailCheck className="size-[18px]" />}>
          Si <strong>{sentTo}</strong> no tenía cuenta, te enviamos un correo con un código de 6 dígitos y un enlace para confirmarla. Revisa también la carpeta de correo no deseado.
        </Alert>
        <form onSubmit={onVerify} className="flex flex-col gap-3" noValidate>
          <Field
            label="Código de verificación"
            icon={<KeyRound className="size-4" />}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
            error={codeError ?? undefined}
            hint="El código que viene en el correo."
            required
          />
          {resent ? <Alert tone="info">Te enviamos un código nuevo.</Alert> : null}
          <Button variant="primary" type="submit" className="w-full" disabled={verifying || code.replace(/\s/g, "").length < 6}>
            {verifying ? "Verificando…" : "Verificar correo"}
          </Button>
          <button type="button" onClick={onResend} className="self-center text-[13.5px] font-bold text-hoja underline-offset-2 hover:underline">
            Reenviar el código
          </button>
        </form>
        <Link href="/ingresar" className={buttonStyles({ variant: "ghost" })}>
          Ya confirmé: ir a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Nombre completo" icon={<UserRound className="size-4" />} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
      <Field label="Correo" icon={<Mail className="size-4" />} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
      <NewPasswordFields password={password} onPasswordChange={setPassword} confirm={confirm} onConfirmChange={setConfirm} errors={{ password: errors.password, confirm: errors.confirm }} />
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
