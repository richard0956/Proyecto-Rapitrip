"use client";

import { Alert, Button, Field } from "@rapitrip/ui";
import { Lock, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { acceptInvitation } from "@/lib/accept-invitation";

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) return setMismatch(true);
    setMismatch(false);
    setBusy(true);
    const result = await acceptInvitation({ token, password, fullName });
    if (result.ok) return router.replace("/login?invitacion=ok");
    setError(result.message);
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Nombre completo" icon={<UserRound className="size-4" />} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Field label="Contraseña" icon={<Lock className="size-4" />} hint="Entre 8 y 72 caracteres." type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Field label="Repite la contraseña" icon={<Lock className="size-4" />} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? "Las contraseñas no coinciden." : undefined} required />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="w-full" disabled={busy || !password || !confirm}>
        {busy ? "Creando acceso…" : "Crear acceso"}
      </Button>
    </form>
  );
}
