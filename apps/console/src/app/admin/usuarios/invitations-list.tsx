"use client";

import { Badge, Card, DataTable, type Column } from "@rapitrip/ui";
import { MailPlus } from "lucide-react";
import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/action-error";
import { CancelInvitationButton } from "./cancel-invitation-button";

export type InvitationRow = { id: string; email: string; roleLabel: string; sent: string; expires: string; daysLeft: number | null; canCancel: boolean };

/** Invitaciones pendientes en su propia pestaña: a quién, con qué rol y cuánto le queda al enlace antes de vencer. */
export function InvitationsList({ invitations, cancel, invite }: { invitations: InvitationRow[]; cancel: (input: { id: string }) => Promise<ActionResult>; invite: ReactNode }) {
  const columns: Column<InvitationRow>[] = [
    {
      header: "Correo",
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-durazno text-durazno-texto">
            <MailPlus className="size-4" />
          </span>
          <span className="font-bold">{row.email}</span>
        </span>
      ),
    },
    { header: "Rol", cell: (row) => row.roleLabel },
    { header: "Enviada", cell: (row) => <span className="whitespace-nowrap tabular-nums">{row.sent}</span> },
    {
      header: "Vence",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <span className="whitespace-nowrap tabular-nums">{row.expires}</span>
          {row.daysLeft !== null ? <Badge tone={row.daysLeft <= 1 ? "warning" : "neutral"}>{row.daysLeft === 0 ? "Vence hoy" : row.daysLeft === 1 ? "Queda 1 día" : `Quedan ${row.daysLeft} días`}</Badge> : null}
        </span>
      ),
    },
    { header: "Acción", className: "w-px whitespace-nowrap pr-5 text-right", cell: (row) => (row.canCancel ? <CancelInvitationButton id={row.id} email={row.email} cancel={cancel} /> : <span className="text-tinta-suave">—</span>) },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-tinta">Invitaciones pendientes</h2>
          <p className="text-[12.5px] text-tinta-suave">Cada enlace sirve una sola vez y vence a los 4 días. Las que se aceptan pasan a «Cuentas».</p>
        </div>
      </div>
      {invitations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-borde-campo px-6 py-10 text-center">
          <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-durazno text-durazno-texto">
            <MailPlus className="size-6" />
          </span>
          <div>
            <p className="text-[15px] font-bold text-tinta">No hay invitaciones pendientes</p>
            <p className="text-[13px] text-tinta-suave">Invita a alguien del equipo para que reciba su enlace de acceso.</p>
          </div>
          {invite}
        </div>
      ) : (
        <DataTable caption="Invitaciones pendientes" columns={columns} rows={invitations} rowKey={(row) => row.id} emptyTitle="" />
      )}
    </Card>
  );
}
