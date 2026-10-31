"use client";

import { Alert, Button, Field } from "@rapitrip/ui";
import { Lock, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { acceptInvitation } from "@/lib/accept-invitation";
import { useKeyboardFit } from "@/lib/use-keyboard-fit";

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useKeyboardFit(formRef);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) return setMismatch(true);
    setMismatch(false);
    setBusy(true);
    const result = await acceptInvitation({ token, password, fullName });
    if (result.ok) return router.replace("/ingresar?invitacion=ok");
    setError(result.message);
    setBusy(false);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {/* `text-base` (16px): con menos, Safari del iPhone amplía la página al enfocar el campo. */}
      <Field label="Nombre completo" icon={<UserRound className="size-4" />} className="text-base" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <Field label="Contraseña" icon={<Lock className="size-4" />} className="text-base" hint="Entre 8 y 72 caracteres." type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Field label="Repite la contraseña" icon={<Lock className="size-4" />} className="text-base" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? "Las contraseñas no coinciden." : undefined} required />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="min-h-12 w-full text-base" disabled={busy || !password || !confirm}>
        {busy ? "Creando acceso…" : "Crear acceso"}
      </Button>
    </form>
  );
}
