import { canManageRole } from "@rapitrip/supabase";
import { appRoleSchema } from "@rapitrip/validation";
import { Alert, Badge, Card, buttonStyles, cn, initials } from "@rapitrip/ui";
import { ArrowLeft, ArrowUpRight, BadgeCheck, Building2, Clock, Info, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { formatDate, roleLabel } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { personalRoles, platformScope, roleStatusText, roleStatusTone } from "@/lib/staff";
import { serverSupabase } from "@/lib/supabase";
import { changeRoleStatus, resetMfa } from "../actions";
import { ResetMfaButton, RoleActions } from "../user-actions";

/** Ficha de una persona con rol: quién es, sus roles (uno por tarjeta, con sus acciones) y la seguridad de su cuenta. */
export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const session = await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [accounts, commerces] = await Promise.all([
    supabase.from("accounts_staff").select("*").eq("user_id", id).order("granted_at", { ascending: false }),
    supabase.from("commerces_list").select("id, name, kind"),
  ]);
  if (accounts.error) console.error("[usuario]", accounts.error.message);
  const rows = accounts.data ?? [];
  const person = rows[0];
  if (!accounts.error && !person) notFound();

  const isMe = id === session.userId;
  const commerceOf = new Map((commerces.data ?? []).map((c) => [c.id, c]));
  const roles = rows.flatMap((row) => {
    const role = appRoleSchema.safeParse(row.role);
    if (!role.success || !row.role_status) return [];
    const commerce = row.commerce_id ? commerceOf.get(row.commerce_id) : undefined;
    return [
      {
        key: `${row.role}-${row.commerce_id ?? ""}`,
        role: role.data,
        label: roleLabel[role.data] ?? role.data,
        status: row.role_status,
        since: formatDate(row.granted_at),
        scope: commerce ? commerce.name : (platformScope[role.data] ?? "—"),
        commerceHref: commerce?.id ? `/admin/${commerce.kind === "empresa" ? "comercios" : "vendedores"}/${commerce.id}` : null,
        isPersonal: personalRoles.has(role.data),
        canManage: !isMe && role.data !== "superadmin" && canManageRole(session.role, role.data),
      },
    ];
  });
  const name = person?.full_name ?? person?.email ?? "Sin nombre";
  const active = roles.filter((role) => role.status === "activo");
  const canResetMfa = roles.some((role) => role.canManage && role.status === "activo");
  const hasCommerceRole = roles.some((role) => role.role === "comercio");

  return (
    <>
      <Link href="/admin/usuarios" className={buttonStyles({ variant: "ghost", className: "-ml-3 mb-3 min-h-9 px-3 text-[13px]" })}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Usuarios y roles
      </Link>
      {accounts.error ? <Alert tone="error" className="mb-5">No pudimos cargar la cuenta. Recarga la página.</Alert> : null}

      <div className="flex flex-col gap-5">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-menta to-bruma text-xl font-extrabold text-hoja ring-1 ring-borde">
                {initials(name)}
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={person?.account_status === "activa" ? "positive" : "warning"}>{person?.account_status === "activa" ? "Cuenta activa" : "Cuenta inactiva"}</Badge>
                  {isMe ? <span className="rounded-full bg-lavanda px-2.5 py-0.5 text-[11.5px] font-bold text-marino">Es tu cuenta</span> : null}
                </div>
                <h1 className="truncate text-[24px] font-extrabold leading-tight tracking-tight text-tinta">{name}</h1>
                <p className="truncate text-[13px] text-tinta-suave">{person?.email ?? "—"}</p>
              </div>
            </div>
            <dl className="grid shrink-0 grid-cols-3 gap-2 lg:flex lg:gap-2.5">
              <Stat label="Roles" value={roles.length} />
              <Stat label="Activos" value={active.length} />
              <Stat label="Primer rol" value={roles.at(-1)?.since ?? "—"} />
            </dl>
          </div>
        </Card>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-5 sm:p-6">
            <Heading icon={<BadgeCheck className="size-[18px]" />} title="Roles" subtitle="Lo que esta persona puede hacer en Rapitrip. Cada cambio pide un motivo y queda en la auditoría." />
            {roles.length === 0 ? (
              <p className="rounded-panel border border-dashed border-borde-campo px-4 py-8 text-center text-[13px] text-tinta-suave">Sin roles asignados.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {roles.map((role) => (
                  <li key={role.key} className={cn("rounded-panel p-4 ring-1", role.status === "revocado" ? "bg-crema/60 ring-borde" : "bg-papel ring-borde")}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", role.isPersonal ? "bg-lavanda text-marino" : "bg-menta text-hoja")}>
                          {role.isPersonal ? <ShieldCheck className="size-5" /> : <Building2 className="size-5" />}
                        </span>
                        <div className="min-w-0">
                          <p className={cn("text-[15px] font-bold", role.status === "revocado" ? "text-tinta-suave" : "text-tinta")}>{role.label}</p>
                          <p className="text-[12.5px] text-tinta-suave">
                            {role.commerceHref ? (
                              <Link href={role.commerceHref} className="font-semibold text-hoja underline-offset-2 hover:underline">
                                {role.scope}
                              </Link>
                            ) : (
                              role.scope
                            )}{" "}
                            · desde {role.since}
                          </p>
                        </div>
                      </div>
                      <Badge tone={roleStatusTone[role.status]}>{roleStatusText[role.status]}</Badge>
                    </div>
                    {role.status === "revocado" ? (
                      <p className="mt-3 text-[12.5px] text-tinta-suave">Este rol fue revocado y no admite más cambios.</p>
                    ) : role.canManage ? (
                      <div className="mt-3 border-t border-borde pt-3">
                        <RoleActions userId={id} role={role.role} roleLabel={role.label} status={role.status} name={name} change={changeRoleStatus} />
                      </div>
                    ) : (
                      <p className="mt-3 text-[12.5px] text-tinta-suave">{isMe ? "No puedes cambiar tus propios roles." : "No puedes gestionar este rol: es de igual o mayor rango que el tuyo."}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {hasCommerceRole ? (
              <p className="mt-4 flex items-start gap-2 rounded-panel bg-lavanda/60 px-3.5 py-3 text-[12.5px] leading-snug text-tinta">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-marino" />
                Suspender el rol de comercio no afecta su acceso como cliente en la tienda.
              </p>
            ) : null}
          </Card>

          <div className="flex flex-col gap-5 xl:sticky xl:top-6">
            <Card className="p-5">
              <Heading icon={<KeyRound className="size-[18px]" />} tone="lavanda" title="Segundo factor" subtitle="Si perdió su teléfono o cambió de aplicación de autenticación." />
              {canResetMfa ? (
                <ResetMfaButton userId={id} name={name} reset={resetMfa} />
              ) : (
                <p className="text-[12.5px] text-tinta-suave">{isMe ? "Tu segundo factor se gestiona en «Mi cuenta»." : "Solo se restablece a cuentas activas de menor rango que el tuyo."}</p>
              )}
            </Card>
            <Card className="p-5">
              <Heading icon={<Clock className="size-[18px]" />} tone="durazno" title="Actividad" subtitle="Los ingresos y los cambios de esta cuenta quedan registrados." />
              <div className="flex flex-col gap-2">
                <Link href={`/admin/accesos?cuenta=${id}`} className={buttonStyles({ variant: "secondary", className: "w-full justify-between" })}>
                  Ver sus inicios de sesión
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
                <Link href="/admin/auditoria" className={buttonStyles({ variant: "ghost", className: "w-full justify-between" })}>
                  Ir a la auditoría
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-crema px-3.5 py-2.5">
      <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
      <dd className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-tinta">{value}</dd>
    </div>
  );
}

function Heading({ icon, title, subtitle, tone = "menta" }: { icon: ReactNode; title: string; subtitle?: string; tone?: "menta" | "lavanda" | "durazno" }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", tone === "menta" ? "bg-menta text-hoja" : tone === "lavanda" ? "bg-lavanda text-marino" : "bg-durazno text-durazno-texto")}>
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-tinta">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[12.5px] leading-snug text-tinta-suave">{subtitle}</p> : null}
      </div>
    </div>
  );
}
