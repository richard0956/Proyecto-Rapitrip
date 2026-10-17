"use client";

import { Button } from "@rapitrip/ui";
import { useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

type Props = {
  userId: string;
  role: string;
  roleStatus: "activo" | "suspendido" | "revocado";
  name: string;
  canManage: boolean;
  canResetMfa: boolean;
  change: (input: { userId: string; role: string; to: "activo" | "suspendido" | "revocado"; reason: string }) => Promise<ActionResult>;
  reset: (input: { userId: string; reason: string }) => Promise<ActionResult>;
};

type Dialog = "suspender" | "reactivar" | "revocar" | "mfa" | null;

export function UserActions({ userId, role, roleStatus, name, canManage, canResetMfa, change, reset }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  if (roleStatus === "revocado" || (!canManage && !canResetMfa)) return <span className="text-tinta-suave">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {canManage && roleStatus === "activo" ? (
        <Button variant="ghost" className="min-h-9 px-3" onClick={() => setDialog("suspender")} aria-label={`Suspender a ${name}`}>
          Suspender
        </Button>
      ) : null}
      {canManage && roleStatus === "suspendido" ? (
        <Button variant="ghost" className="min-h-9 px-3" onClick={() => setDialog("reactivar")} aria-label={`Reactivar a ${name}`}>
          Reactivar
        </Button>
      ) : null}
      {canManage ? (
        <Button variant="ghost" className="min-h-9 px-3" onClick={() => setDialog("revocar")} aria-label={`Revocar el rol de ${name}`}>
          Revocar
        </Button>
      ) : null}
      {canResetMfa ? (
        <Button variant="ghost" className="min-h-9 px-3" onClick={() => setDialog("mfa")} aria-label={`Restablecer el segundo factor de ${name}`}>
          Restablecer MFA
        </Button>
      ) : null}

      <ReasonDialog open={dialog === "suspender"} onClose={close} title="Suspender rol" description={`${name} no podrá usar el rol ${role} hasta que lo reactives.`} confirmLabel="Suspender" onConfirm={(reason) => change({ userId, role, to: "suspendido", reason })} />
      <ReasonDialog open={dialog === "reactivar"} onClose={close} title="Reactivar rol" description={`${name} recuperará el rol ${role}.`} confirmLabel="Reactivar" onConfirm={(reason) => change({ userId, role, to: "activo", reason })} />
      <ReasonDialog open={dialog === "revocar"} onClose={close} title="Revocar rol" description={`Se quitará el rol ${role} a ${name}. No se puede deshacer.`} confirmLabel="Revocar" danger onConfirm={(reason) => change({ userId, role, to: "revocado", reason })} />
      <ReasonDialog open={dialog === "mfa"} onClose={close} title="Restablecer segundo factor" description={`${name} tendrá que enrolar su aplicación de autenticación al volver a ingresar. Exige que hayas verificado tu propio segundo factor en los últimos 5 minutos.`} confirmLabel="Restablecer" danger minLength={10} onConfirm={(reason) => reset({ userId, reason })} />
    </div>
  );
}
