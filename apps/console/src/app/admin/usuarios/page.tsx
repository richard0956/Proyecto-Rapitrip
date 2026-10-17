import { canManageRole, invitableRoles } from "@rapitrip/supabase";
import { appRoleSchema } from "@rapitrip/validation";
import { Alert, Badge, DataTable } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDate, roleLabel } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { cancelInvitation, changeRoleStatus, inviteStaff, resetMfa } from "./actions";
import { CancelInvitationButton } from "./cancel-invitation-button";
import { InviteButton } from "./invite-button";
import { UserActions } from "./user-actions";

const statusTone = { activo: "positive", suspendido: "alert", revocado: "neutral" } as const;

export default async function UsuariosPage() {
  const session = await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [accounts, invitations] = await Promise.all([
    supabase.from("accounts_staff").select("*").order("granted_at", { ascending: false }),
    supabase.from("invitations_list").select("*").eq("status", "pendiente").order("created_at", { ascending: false }),
  ]);
  const roles = invitableRoles(session.role);
  const loadFailed = accounts.error || invitations.error;
  if (loadFailed) console.error("[usuarios]", accounts.error?.message, invitations.error?.message);

  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Personas con acceso a la consola y a las cuentas de comercio. Cada cambio queda auditado con su motivo."
        actions={roles.length > 0 ? <InviteButton roles={roles} invite={inviteStaff} /> : null}
      />
      {loadFailed ? <Alert tone="error" className="mb-6">No pudimos cargar la información. Recarga la página.</Alert> : null}

      <section aria-labelledby="equipo" className="mb-10">
        <h2 id="equipo" className="mb-3 font-titulo text-xl text-selva">
          Cuentas con rol
        </h2>
        <DataTable
          caption="Cuentas con rol"
          rows={accounts.data ?? []}
          rowKey={(row) => `${row.user_id}-${row.role}-${row.commerce_id ?? ""}`}
          emptyTitle="Todavía no hay cuentas con rol"
          columns={[
            { header: "Nombre", cell: (row) => <span className="font-bold">{row.full_name ?? "—"}</span> },
            { header: "Correo", cell: (row) => row.email ?? "—" },
            { header: "Rol", cell: (row) => roleLabel[row.role ?? ""] ?? row.role },
            { header: "Estado", cell: (row) => (row.role_status ? <Badge tone={statusTone[row.role_status]}>{row.role_status}</Badge> : "—") },
            { header: "Desde", cell: (row) => formatDate(row.granted_at) },
            {
              header: "Acciones",
              cell: (row) => {
                const role = appRoleSchema.safeParse(row.role);
                const self = row.user_id === session.userId;
                const manageable = role.success && !self && role.data !== "superadmin" && canManageRole(session.role, role.data);
                return (
                  <UserActions
                    userId={row.user_id ?? ""}
                    role={row.role ?? ""}
                    roleStatus={row.role_status ?? "revocado"}
                    name={row.full_name ?? row.email ?? "esta persona"}
                    canManage={manageable}
                    canResetMfa={manageable && row.role_status === "activo"}
                    change={changeRoleStatus}
                    reset={resetMfa}
                  />
                );
              },
            },
          ]}
        />
      </section>

      <section aria-labelledby="invitaciones">
        <h2 id="invitaciones" className="mb-3 font-titulo text-xl text-selva">
          Invitaciones pendientes
        </h2>
        <DataTable
          caption="Invitaciones pendientes"
          rows={invitations.data ?? []}
          rowKey={(row) => row.id ?? ""}
          emptyTitle="No hay invitaciones pendientes"
          emptyHint="Las invitaciones aceptadas aparecen arriba como cuentas con rol."
          columns={[
            { header: "Correo", cell: (row) => row.email ?? "—" },
            { header: "Rol", cell: (row) => roleLabel[row.role ?? ""] ?? row.role },
            { header: "Vence", cell: (row) => formatDate(row.expires_at) },
            {
              header: "Acciones",
              cell: (row) => (canManageRole(session.role, appRoleSchema.catch("cliente").parse(row.role)) ? <CancelInvitationButton id={row.id ?? ""} email={row.email ?? ""} cancel={cancelInvitation} /> : "—"),
            },
          ]}
        />
      </section>
    </>
  );
}
