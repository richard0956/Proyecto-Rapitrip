"use client";

import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, pillStyles, SelectField, Table, Td, Th, THead, Tr } from "@rapitrip/ui";
import { Mail, Search, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

export type StaffRow = {
  key: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  scope: string;
  status: "activo" | "suspendido" | "revocado";
  isPersonal: boolean;
  canManage: boolean;
  canResetMfa: boolean;
};

export type InvitationRow = { id: string; email: string; roleLabel: string; expires: string; canCancel: boolean };

type Props = {
  rows: StaffRow[];
  invitations: InvitationRow[];
  inviteRoles: { value: string; label: string }[];
  change: (input: { userId: string; role: string; to: "activo" | "suspendido" | "revocado"; reason: string }) => Promise<ActionResult>;
  reset: (input: { userId: string; reason: string }) => Promise<ActionResult>;
  invite: (input: { email: string; role: string }) => Promise<ActionResult>;
  cancel: (input: { id: string }) => Promise<ActionResult>;
};

const statusTone = { activo: "positive", suspendido: "danger", revocado: "neutral" } as const;
const statusText = { activo: "Activo", suspendido: "Suspendido", revocado: "Revocado" } as const;
type Tab = "todos" | "personal" | "comercios";
type Dialog = "suspender" | "reactivar" | "revocar" | "mfa" | null;

export function UsersWorkspace({ rows, invitations, inviteRoles, change, reset, invite, cancel }: Props) {
  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const counts = { todos: rows.length, personal: rows.filter((r) => r.isPersonal).length, comercios: rows.filter((r) => !r.isPersonal).length };
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => (tab === "todos" || (tab === "personal") === row.isPersonal) && (!text || `${row.name} ${row.email} ${row.scope}`.toLowerCase().includes(text)));
  }, [rows, tab, query]);
  const selected = rows.find((row) => row.key === selectedKey) ?? null;
  const close = () => setDialog(null);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <Card>
          <div role="tablist" aria-label="Filtrar cuentas" className="mb-3.5 flex flex-wrap gap-2.5">
            {(["todos", "personal", "comercios"] as const).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={pillStyles(tab === key)}>
                {{ todos: "Todos", personal: "Personal", comercios: "Comercios" }[key]} · {counts[key]}
              </button>
            ))}
          </div>
          <div className="mb-3.5">
            <Field label="Buscar" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, correo o comercio" />
          </div>
          {visible.length === 0 ? (
            <EmptyState title="Sin resultados">Prueba con otro filtro o con otra búsqueda.</EmptyState>
          ) : (
            <Table caption="Cuentas con rol">
              <THead>
                <tr>
                  <Th>Usuario</Th>
                  <Th>Rol</Th>
                  <Th>Alcance</Th>
                  <Th>Estado</Th>
                </tr>
              </THead>
              <tbody>
                {visible.map((row) => {
                  const active = row.key === selectedKey;
                  return (
                    <Tr key={row.key} className={active ? "bg-menta/50" : "hover:bg-calido/60"}>
                      <Td>
                        <button type="button" aria-pressed={active} onClick={() => setSelectedKey(active ? null : row.key)} className="flex w-full items-center gap-2.5 rounded-campo text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                          <Avatar name={row.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{row.name}</span>
                            <span className="block truncate text-xs text-tinta-suave">{row.email}</span>
                          </span>
                        </button>
                      </Td>
                      <Td>{row.roleLabel}</Td>
                      <Td>{row.scope}</Td>
                      <Td>
                        <Badge tone={statusTone[row.status]}>{statusText[row.status]}</Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Invitaciones pendientes" subtitle="Vencen a los 4 días y sirven una sola vez." />
          {invitations.length === 0 ? (
            <EmptyState title="No hay invitaciones pendientes">Las que se acepten pasan a la lista de cuentas.</EmptyState>
          ) : (
            <Table caption="Invitaciones pendientes">
              <THead>
                <tr>
                  <Th>Correo</Th>
                  <Th>Rol</Th>
                  <Th>Vence</Th>
                  <Th>
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </THead>
              <tbody>
                {invitations.map((invitation) => (
                  <Tr key={invitation.id}>
                    <Td className="font-medium">{invitation.email}</Td>
                    <Td>{invitation.roleLabel}</Td>
                    <Td>{invitation.expires}</Td>
                    <Td className="text-right">{invitation.canCancel ? <CancelButton id={invitation.id} email={invitation.email} cancel={cancel} /> : null}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-5 xl:sticky xl:top-6">
        {inviteRoles.length > 0 ? <InviteForm roles={inviteRoles} invite={invite} /> : null}
        <Card>
          <CardHeader title="Acciones sobre el rol" subtitle={selected ? `${selected.name} · ${selected.roleLabel}` : "Elige una cuenta de la lista"} />
          {selected ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {selected.canManage && selected.status === "activo" ? (
                  <Button variant="soft" onClick={() => setDialog("suspender")}>
                    Suspender
                  </Button>
                ) : null}
                {selected.canManage && selected.status === "suspendido" ? (
                  <Button variant="secondary" onClick={() => setDialog("reactivar")}>
                    Reactivar
                  </Button>
                ) : null}
                {selected.canManage && selected.status !== "revocado" ? (
                  <Button variant="danger" onClick={() => setDialog("revocar")}>
                    Revocar
                  </Button>
                ) : null}
                {selected.canResetMfa ? (
                  <Button variant="ghost" onClick={() => setDialog("mfa")}>
                    Restablecer segundo factor
                  </Button>
                ) : null}
              </div>
              {!selected.canManage && !selected.canResetMfa ? <Alert>No puedes gestionar este rol: es el tuyo o uno de igual o mayor rango.</Alert> : null}
              {selected.status === "revocado" ? <Alert>Este rol ya fue revocado y no admite más cambios.</Alert> : null}
              <Alert>Suspender el rol de comercio no afecta su acceso como cliente en la tienda.</Alert>
            </div>
          ) : (
            <EmptyState title="Ninguna cuenta elegida">Selecciona a alguien para suspender, reactivar o revocar su rol.</EmptyState>
          )}
        </Card>
      </div>

      {selected ? (
        <>
          <ReasonDialog open={dialog === "suspender"} onClose={close} title="Suspender rol" description={`${selected.name} no podrá usar el rol ${selected.roleLabel} hasta que lo reactives.`} confirmLabel="Suspender" onConfirm={(reason) => change({ userId: selected.userId, role: selected.role, to: "suspendido", reason })} />
          <ReasonDialog open={dialog === "reactivar"} onClose={close} title="Reactivar rol" description={`${selected.name} recuperará el rol ${selected.roleLabel}.`} confirmLabel="Reactivar" onConfirm={(reason) => change({ userId: selected.userId, role: selected.role, to: "activo", reason })} />
          <ReasonDialog open={dialog === "revocar"} onClose={close} title="Revocar rol" description={`Se quitará el rol ${selected.roleLabel} a ${selected.name}. No se puede deshacer.`} confirmLabel="Revocar" danger onConfirm={(reason) => change({ userId: selected.userId, role: selected.role, to: "revocado", reason })} />
          <ReasonDialog open={dialog === "mfa"} onClose={close} title="Restablecer segundo factor" description={`${selected.name} tendrá que enrolar su aplicación de autenticación al volver a ingresar. Exige que hayas verificado tu propio segundo factor en los últimos 5 minutos.`} confirmLabel="Restablecer" danger minLength={10} onConfirm={(reason) => reset({ userId: selected.userId, reason })} />
        </>
      ) : null}
    </div>
  );
}

function InviteForm({ roles, invite }: { roles: { value: string; label: string }[]; invite: Props["invite"] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[0]?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSentTo(null);
    start(async () => {
      const result = await invite({ email, role });
      if (!result.ok) return setError(result.error);
      setSentTo(email);
      setEmail("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader title="Invitar a una persona" subtitle="Recibe un enlace de un solo uso" />
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Field label="Correo" icon={<Mail className="size-4" />} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" required />
        <SelectField label="Rol" value={role} onChange={(e) => setRole(e.target.value)} hint="Nadie asigna un rol igual o superior al suyo. Solo el director crea administradores.">
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {sentTo ? <Alert icon={<UserRoundCheck className="size-[18px]" />}>Enviamos la invitación a {sentTo}. El enlace vence en 4 días.</Alert> : null}
        <Button variant="primary" type="submit" disabled={pending || !email || !role}>
          <Mail className="size-4" aria-hidden="true" />
          {pending ? "Enviando…" : "Enviar invitación"}
        </Button>
      </form>
    </Card>
  );
}

function CancelButton({ id, email, cancel }: { id: string; email: string; cancel: Props["cancel"] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        className="min-h-9 px-3"
        disabled={pending}
        aria-label={`Cancelar la invitación de ${email}`}
        onClick={() =>
          start(async () => {
            const result = await cancel({ id });
            if (!result.ok) return setError(result.error);
            router.refresh();
          })
        }
      >
        {pending ? "Cancelando…" : "Cancelar"}
      </Button>
      {error ? (
        <span role="alert" className="text-xs font-bold">
          {error}
        </span>
      ) : null}
    </span>
  );
}
