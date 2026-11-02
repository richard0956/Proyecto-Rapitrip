"use client";

import { genericLoginError as genericError } from "@rapitrip/supabase";
import { Alert, Button, Field } from "@rapitrip/ui";
import { emailSchema } from "@rapitrip/validation";
import { Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { claimsHaveCourierRole } from "@/lib/claims";
import { getSupabase } from "@/lib/client";
import { useKeyboardFit } from "@/lib/use-keyboard-fit";
import { signInWithPasswordAction } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useKeyboardFit(formRef);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setFieldError("Escribe un correo válido.");
    setFieldError(null);

    setBusy(true);
    const supabase = getSupabase();
    // Si la llamada al servidor no sale, el teléfono no tiene señal.
    const result = await signInWithPasswordAction(parsed.data, password, null).catch(() => "offline" as const);
    // El servidor abrió la sesión; el teléfono la guarda en su cookie como si hubiera ingresado él.
    const sessionError = result !== "offline" && result.ok ? (await supabase.auth.setSession(result.session)).error : null;
    if (result === "offline" || !result.ok || sessionError) {
      setError(result === "offline" ? "Sin conexión. Revisa tu señal e inténtalo de nuevo." : !result.ok && result.message ? result.message : genericError);
      setBusy(false);
      return;
    }
    // Una cuenta de cliente o de la consola no entra aquí: se cierra la sesión recién abierta y se avisa.
    const { data } = await supabase.auth.getClaims();
    if (!claimsHaveCourierRole(data?.claims as Record<string, unknown> | undefined)) {
      await supabase.auth.signOut();
      setError("Esta cuenta no tiene acceso de repartidor. Pide a coordinación que te invite.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {/* `text-base` (16px): con menos, Safari del iPhone amplía la página al enfocar el campo. */}
      <Field label="Correo" icon={<Mail className="size-4" />} className="text-base" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError ?? undefined} required />
      <Field label="Contraseña" icon={<Lock className="size-4" />} className="text-base" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="min-h-12 w-full text-base" disabled={busy || !email || !password}>
        {busy ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
