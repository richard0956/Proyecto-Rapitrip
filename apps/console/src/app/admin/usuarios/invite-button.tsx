"use client";

import { Alert, Button, Dialog, Field, SelectField } from "@rapitrip/ui";
import { Mail, UserPlus, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

/** «Invitar persona»: abre el formulario en un diálogo; la persona recibe un enlace de un solo uso que vence a los 4 días. */
export function InviteButton({ roles, invite }: { roles: { value: string; label: string }[]; invite: (input: { email: string; role: string }) => Promise<ActionResult> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[0]?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setOpen(false);
    setEmail("");
    setError(null);
    setSentTo(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await invite({ email, role });
      if (!result.ok) return setError(result.error);
      setSentTo(email);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden="true" />
        Invitar persona
      </Button>
      <Dialog open={open} onClose={close} title="Invitar a una persona">
        {sentTo ? (
          <div className="flex flex-col gap-4">
            <Alert icon={<UserRoundCheck className="size-[18px]" />}>Enviamos la invitación a {sentTo}. El enlace vence en 4 días y sirve una sola vez.</Alert>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setSentTo(null); setEmail(""); }}>
                Invitar a otra persona
              </Button>
              <Button variant="secondary" onClick={close}>
                Listo
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <Field label="Correo" icon={<Mail className="size-4" />} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" required />
            <SelectField label="Rol" value={role} onChange={(e) => setRole(e.target.value)} hint="Nadie asigna un rol igual o superior al suyo. Solo el director crea administradores.">
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </SelectField>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={pending}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" disabled={pending || !email || !role}>
                <Mail className="size-4" aria-hidden="true" />
                {pending ? "Enviando…" : "Enviar invitación"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
