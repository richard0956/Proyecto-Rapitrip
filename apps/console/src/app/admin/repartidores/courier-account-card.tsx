"use client";

import { Alert, Badge, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

type Props = {
  id: string;
  name: string;
  /** La ficha está activa: solo así se puede invitar. */
  active: boolean;
  hasAccount: boolean;
  available: boolean;
  /** Fecha ya formateada de la invitación pendiente, si existe. */
  pendingUntil: string | null;
  invite: (input: { id: string; email: string }) => Promise<ActionResult>;
  revoke: (input: { id: string; reason: string }) => Promise<ActionResult>;
};

/** Acceso del repartidor a su aplicación: invitar por correo o quitarle el acceso (solo administración). */
export function CourierAccountCard({ id, name, active, hasAccount, available, pendingUntil, invite, revoke }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await invite({ id, email });
      setMessage(result.ok ? { ok: true, text: `Enviamos la invitación a ${email}. El enlace vence en 4 días y sirve una sola vez.` } : { ok: false, text: result.error });
      if (result.ok) {
        setEmail("");
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Acceso a la aplicación"
        subtitle="Cuenta del repartidor"
        actions={hasAccount ? <Badge tone={available ? "positive" : "neutral"}>{available ? "Disponible" : "No disponible"}</Badge> : <Badge tone="neutral">{pendingUntil ? "Invitación pendiente" : "Sin cuenta"}</Badge>}
      />
      {hasAccount ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {name} ya tiene su cuenta y entra desde su teléfono. Si perdió el teléfono o deja de trabajar con nosotros, quítale el acceso: se cierran sus sesiones al instante.
          </p>
          <div>
            <Button variant="danger" onClick={() => setRevokeOpen(true)} disabled={pending}>
              Quitar acceso
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          {pendingUntil ? <Alert tone="info">Hay una invitación pendiente que vence el {pendingUntil}. Si envías otra, reemplaza a la anterior.</Alert> : null}
          {!active ? <Alert tone="warning">Activa la ficha antes de invitar al repartidor.</Alert> : null}
          <Field label="Correo del repartidor" icon={<Mail className="size-4" />} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!active} required />
          <div>
            <Button variant="primary" type="submit" disabled={pending || !active || !email}>
              {pending ? "Enviando…" : pendingUntil ? "Enviar otra invitación" : "Enviar invitación"}
            </Button>
          </div>
        </form>
      )}
      {message ? <Alert tone={message.ok ? "info" : "error"} className="mt-3.5">{message.text}</Alert> : null}
      <ReasonDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title="Quitar acceso al repartidor"
        description={`${name} dejará de entrar a la aplicación y se cerrarán sus sesiones. Su ficha se conserva y se le puede invitar de nuevo.`}
        confirmLabel="Quitar acceso"
        danger
        onConfirm={(reason) => revoke({ id, reason })}
      />
    </Card>
  );
}
