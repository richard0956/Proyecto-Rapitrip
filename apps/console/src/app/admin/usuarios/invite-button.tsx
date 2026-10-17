"use client";

import { Alert, Button, Dialog, Field, SelectField } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

const labels: Record<string, string> = { admin: "Administrador", cajero: "Encargado de ventas (caja)", coordinador: "Encargado de ventas (coordinación)" };

export function InviteButton({ roles, invite }: { roles: string[]; invite: (input: { email: string; role: string }) => Promise<ActionResult> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function close() {
    setOpen(false);
    setEmail("");
    setError(null);
    setSent(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await invite({ email, role });
      if (!result.ok) return setError(result.error);
      setSent(true);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Invitar persona
      </Button>
      <Dialog open={open} onClose={close} title="Invitar al equipo">
        {sent ? (
          <div className="flex flex-col gap-4">
            <Alert>Enviamos la invitación a {email}. El enlace vence en 4 días y sirve una sola vez.</Alert>
            <Button variant="secondary" onClick={close}>
              Listo
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label="Correo" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <SelectField label="Rol" value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {labels[r] ?? r}
                </option>
              ))}
            </SelectField>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="secondary" type="submit" disabled={pending || !email || !role}>
                {pending ? "Enviando…" : "Enviar invitación"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
