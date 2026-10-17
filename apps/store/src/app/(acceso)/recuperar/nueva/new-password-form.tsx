"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert, Button, Field } from "@rapitrip/ui";
import { passwordSchema } from "@rapitrip/validation";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function NewPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!passwordSchema.safeParse(password).success) return setErrors({ password: "La contraseña debe tener entre 8 y 72 caracteres." });
    if (password !== confirm) return setErrors({ confirm: "Las contraseñas no coinciden." });
    setErrors({});
    setBusy(true);
    const supabase = createBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("No pudimos guardar la contraseña. Pide un enlace nuevo e inténtalo otra vez.");
      setBusy(false);
      return;
    }
    router.replace("/perfil?clave=ok");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Contraseña nueva" icon={<Lock className="size-4" />} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Entre 8 y 72 caracteres." required />
      <Field label="Repite la contraseña" icon={<Lock className="size-4" />} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} required />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="w-full" disabled={busy || !password || !confirm}>
        {busy ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
