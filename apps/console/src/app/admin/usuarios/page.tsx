import { canManageRole, invitableRoles } from "@rapitrip/supabase";
import { appRoleSchema } from "@rapitrip/validation";
import { Alert, cn } from "@rapitrip/ui";
import { CalendarCheck, MailPlus, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { first, type SearchParams } from "@/lib/filters";
import { formatDate, formatDateTime, roleLabel } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { personalRoles, platformScope } from "@/lib/staff";
import { serverSupabase } from "@/lib/supabase";
import { AccessReview, type AccessReviewRow, type RoleCount } from "./access-review";
import { cancelInvitation, inviteStaff, recordAccessReview } from "./actions";
import { InviteButton } from "./invite-button";
import { InvitationsList, type InvitationRow } from "./invitations-list";
import { UsersWorkspace, type StaffRow } from "./users-workspace";

const DAY_MS = 86_400_000;

async function loadInvitations(supabase: Awaited<ReturnType<typeof serverSupabase>>) {
  const result = await supabase.from("invitations_list").select("*").eq("status", "pendiente").order("created_at", { ascending: false });
  // La hora pertenece a la lectura del servidor; el render utiliza esa misma instantánea.
  return { ...result, fetchedAt: Date.now() };
}

/** Usuarios y roles: las cuentas con rol a todo el ancho y, en su propia pestaña, las invitaciones pendientes. Cada cuenta abre su ficha. */
export default async function UsuariosPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireConsoleAccess("admin");
  const requested = first((await searchParams).vista);
  const view = requested === "invitaciones" ? "invitaciones" : requested === "revision" ? "revision" : "cuentas";
  const supabase = await serverSupabase();
  const [accounts, invitations, commerces, reviewStatus, reviews] = await Promise.all([
    supabase.from("accounts_staff").select("*").order("granted_at", { ascending: false }),
    loadInvitations(supabase),
    supabase.from("commerces_list").select("id, name"),
    supabase.rpc("access_review_status"),
    supabase.rpc("access_reviews"),
  ]);
  if (reviewStatus.error || reviews.error) console.error("[usuarios:revision]", reviewStatus.error?.message, reviews.error?.message);
  const loadFailed = accounts.error || invitations.error;
  if (loadFailed) console.error("[usuarios]", accounts.error?.message, invitations.error?.message);

  const commerceNames = new Map((commerces.data ?? []).map((c) => [c.id, c.name]));
  const rows: StaffRow[] = (accounts.data ?? []).flatMap((row) => {
    const role = appRoleSchema.safeParse(row.role);
    if (!role.success || !row.user_id || !row.role_status) return [];
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
        since: formatDate(row.granted_at),
        isMe: row.user_id === session.userId,
      },
    ];
  });

  const now = invitations.fetchedAt;
  const invitationRows: InvitationRow[] = (invitations.data ?? []).flatMap((row) => {
    if (!row.id || !row.email) return [];
    const daysLeft = row.expires_at ? Math.max(0, Math.ceil((new Date(row.expires_at).getTime() - now) / DAY_MS)) : null;
    return [{ id: row.id, email: row.email, roleLabel: roleLabel[row.role ?? ""] ?? row.role ?? "—", sent: formatDate(row.created_at), expires: formatDate(row.expires_at), daysLeft, canCancel: canManageRole(session.role, appRoleSchema.catch("cliente").parse(row.role)) }];
  });
  const inviteRoles = invitableRoles(session.role).map((value) => ({ value, label: roleLabel[value] ?? value }));

  // Norma 1.1.6: estado de la revisión trimestral y cuentas por rol (las de cliente no son del equipo).
  const status = (reviewStatus.data ?? {}) as { last_at?: string | null; due_at?: string; overdue?: boolean };
  const reviewOverdue = status.overdue ?? true;
  const roleCounts: RoleCount[] = [...new Set(rows.map((row) => row.role))].map((role) => ({
    role: roleLabel[role] ?? role,
    active: rows.filter((row) => row.role === role && row.status === "activo").length,
    suspended: rows.filter((row) => row.role === role && row.status === "suspendido").length,
  }));
  const reviewRows: AccessReviewRow[] = (reviews.data ?? []).map((row) => {
    const snapshot = (row.snapshot ?? {}) as Record<string, Record<string, number>>;
    const active = Object.values(snapshot).reduce((sum, byStatus) => sum + Number(byStatus.activo ?? 0), 0);
    return { id: row.id, reviewedAt: formatDateTime(row.reviewed_at), reviewer: row.reviewer_name ?? "Administración", findings: row.findings, changes: row.changes, summary: `${active} roles activos` };
  });

  const tabs = [
    { key: "cuentas", label: "Cuentas", count: rows.length, icon: <Users className="size-4" aria-hidden="true" />, href: "/admin/usuarios" },
    { key: "invitaciones", label: "Invitaciones pendientes", count: invitationRows.length, icon: <MailPlus className="size-4" aria-hidden="true" />, href: "/admin/usuarios?vista=invitaciones" },
    { key: "revision", label: "Revisión de accesos", count: reviewOverdue ? 1 : 0, icon: <CalendarCheck className="size-4" aria-hidden="true" />, href: "/admin/usuarios?vista=revision" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Alta por invitación, suspensión, reactivación y revocación de roles. Cada cambio queda auditado con su motivo."
        actions={inviteRoles.length > 0 ? <InviteButton roles={inviteRoles} invite={inviteStaff} /> : null}
      />
      {loadFailed ? <Alert tone="error" className="mb-5">No pudimos cargar la información. Recarga la página.</Alert> : null}

      <nav aria-label="Secciones de usuarios" className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = view === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[13.5px] font-bold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
                active ? "bg-hoja text-sobre-acento shadow-pulsa" : "bg-papel text-tinta ring-1 ring-borde hover:bg-menta/60",
              )}
            >
              {tab.icon}
              {tab.label}
              <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] tabular-nums", active ? "bg-white/20" : tab.key !== "cuentas" && tab.count > 0 ? "bg-durazno text-durazno-texto" : "bg-crema text-tinta-suave")}>{tab.key === "revision" ? (reviewOverdue ? "Toca" : "Al día") : tab.count}</span>
            </Link>
          );
        })}
      </nav>

      {view === "revision" ? (
        <AccessReview lastAt={status.last_at ? formatDateTime(status.last_at) : null} dueAt={formatDate(status.due_at)} overdue={reviewOverdue} counts={roleCounts} history={reviewRows} record={recordAccessReview} />
      ) : view === "cuentas" ? <UsersWorkspace rows={rows} /> : <InvitationsList invitations={invitationRows} cancel={cancelInvitation} invite={inviteRoles.length > 0 ? <InviteButton roles={inviteRoles} invite={inviteStaff} /> : null} />}
    </>
  );
}
