import { canManageRole, invitableRoles } from "@rapitrip/supabase";
import { appRoleSchema } from "@rapitrip/validation";
import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDate, roleLabel } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { cancelInvitation, changeRoleStatus, inviteStaff, resetMfa } from "./actions";
import { UsersWorkspace, type InvitationRow, type StaffRow } from "./users-workspace";

const personalRoles = new Set(["superadmin", "admin", "cajero", "coordinador"]);
const platformScope: Record<string, string> = { superadmin: "Plataforma", admin: "Plataforma", cajero: "Operaciones", coordinador: "Operaciones" };

export default async function UsuariosPage() {
  const session = await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [accounts, invitations, commerces] = await Promise.all([
    supabase.from("accounts_staff").select("*").order("granted_at", { ascending: false }),
    supabase.from("invitations_list").select("*").eq("status", "pendiente").order("created_at", { ascending: false }),
    supabase.from("commerces_list").select("id, name"),
  ]);
  const loadFailed = accounts.error || invitations.error;
  if (loadFailed) console.error("[usuarios]", accounts.error?.message, invitations.error?.message);

  const commerceNames = new Map((commerces.data ?? []).map((c) => [c.id, c.name]));
  const rows: StaffRow[] = (accounts.data ?? []).flatMap((row) => {
    const role = appRoleSchema.safeParse(row.role);
    if (!role.success || !row.user_id || !row.role_status) return [];
    const manageable = !(row.user_id === session.userId) && role.data !== "superadmin" && canManageRole(session.role, role.data);
    return [
      {
        key: `${row.user_id}-${row.role}-${row.commerce_id ?? ""}`,
        userId: row.user_id,
        name: row.full_name ?? row.email ?? "Sin nombre",
        email: row.email ?? "—",
        role: role.data,
        roleLabel: roleLabel[role.data] ?? role.data,
        scope: row.commerce_id ? (commerceNames.get(row.commerce_id) ?? "Comercio") : (platformScope[role.data] ?? "—"),
        status: row.role_status,
        isPersonal: personalRoles.has(role.data),
        canManage: manageable,
        canResetMfa: manageable && row.role_status === "activo",
      },
    ];
  });

  const invitationRows: InvitationRow[] = (invitations.data ?? []).flatMap((row) => {
    if (!row.id || !row.email) return [];
    return [{ id: row.id, email: row.email, roleLabel: roleLabel[row.role ?? ""] ?? row.role ?? "—", expires: formatDate(row.expires_at), canCancel: canManageRole(session.role, appRoleSchema.catch("cliente").parse(row.role)) }];
  });

  return (
    <>
      <PageHeader title="Usuarios y roles" description="Alta por invitación, suspensión, reactivación y revocación de roles. Cada cambio queda auditado con su motivo." />
      {loadFailed ? <Alert tone="error" className="mb-5">No pudimos cargar la información. Recarga la página.</Alert> : null}
      <UsersWorkspace
        rows={rows}
        invitations={invitationRows}
        inviteRoles={invitableRoles(session.role).map((value) => ({ value, label: roleLabel[value] ?? value }))}
        change={changeRoleStatus}
        reset={resetMfa}
        invite={inviteStaff}
        cancel={cancelInvitation}
      />
    </>
  );
}
