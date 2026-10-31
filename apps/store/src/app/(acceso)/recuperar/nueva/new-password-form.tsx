"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert, Button } from "@rapitrip/ui";
import { passwordProblem } from "@rapitrip/validation";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { NewPasswordFields } from "@/components/new-password-fields";

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
    const problem = passwordProblem(password);
    if (problem) return setErrors({ password: problem });
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
    router.replace("/ajustes/seguridad?clave=ok");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <NewPasswordFields label="Contraseña nueva" password={password} onPasswordChange={setPassword} confirm={confirm} onConfirmChange={setConfirm} errors={errors} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="w-full" disabled={busy || !password || !confirm}>
        {busy ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
