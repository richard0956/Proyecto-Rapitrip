"use client";

import { Button } from "@rapitrip/ui";
import { KeyRound, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

type Change = (input: { userId: string; role: string; to: "activo" | "suspendido" | "revocado"; reason: string }) => Promise<ActionResult>;
type Dialog = "suspender" | "reactivar" | "revocar" | null;

/** Suspender, reactivar o revocar un rol de la persona desde su ficha. Cada cambio pide un motivo y queda auditado. */
export function RoleActions({ userId, role, roleLabel, status, name, change }: { userId: string; role: string; roleLabel: string; status: "activo" | "suspendido" | "revocado"; name: string; change: Change }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  if (status === "revocado") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === "activo" ? (
        <Button variant="soft" onClick={() => setDialog("suspender")} className="min-h-10 px-4" aria-label={`Suspender el rol ${roleLabel} de ${name}`}>
          <Pause className="size-4" aria-hidden="true" />
          Suspender
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setDialog("reactivar")} className="min-h-10 px-4" aria-label={`Reactivar el rol ${roleLabel} de ${name}`}>
          <Play className="size-4" aria-hidden="true" />
          Reactivar
        </Button>
      )}
      <Button variant="danger" onClick={() => setDialog("revocar")} className="min-h-10 px-4" aria-label={`Revocar el rol ${roleLabel} de ${name}`}>
        <Trash2 className="size-4" aria-hidden="true" />
        Revocar
      </Button>

      <ReasonDialog open={dialog === "suspender"} onClose={close} title="Suspender rol" description={`${name} no podrá usar el rol ${roleLabel} hasta que lo reactives.`} confirmLabel="Suspender" onConfirm={(reason) => change({ userId, role, to: "suspendido", reason })} />
      <ReasonDialog open={dialog === "reactivar"} onClose={close} title="Reactivar rol" description={`${name} recuperará el rol ${roleLabel}.`} confirmLabel="Reactivar" onConfirm={(reason) => change({ userId, role, to: "activo", reason })} />
      <ReasonDialog open={dialog === "revocar"} onClose={close} title="Revocar rol" description={`Se quitará el rol ${roleLabel} a ${name}. No se puede deshacer.`} confirmLabel="Revocar" danger onConfirm={(reason) => change({ userId, role, to: "revocado", reason })} />
    </div>
  );
}

/** Restablecer el segundo factor: la persona vuelve a enrolar su aplicación de autenticación al ingresar. */
export function ResetMfaButton({ userId, name, reset }: { userId: string; name: string; reset: (input: { userId: string; reason: string }) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        <KeyRound className="size-4" aria-hidden="true" />
        Restablecer segundo factor
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Restablecer segundo factor"
        description={`${name} tendrá que enrolar su aplicación de autenticación al volver a ingresar. Exige que hayas verificado tu propio segundo factor en los últimos 5 minutos.`}
        confirmLabel="Restablecer"
        danger
        minLength={10}
        onConfirm={(reason) => reset({ userId, reason })}
      />
    </>
  );
}
