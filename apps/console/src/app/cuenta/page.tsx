import { Alert, Avatar, Badge, Card, CardHeader, DataTable } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDate, formatDateTime, roleLabel } from "@/lib/format";
import { requireAnyConsoleSession } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { updateProfile } from "./actions";
import { ProfileForm } from "./profile-form";

export default async function CuentaPage() {
  await requireAnyConsoleSession();
  const supabase = await serverSupabase();
  const [profile, roles] = await Promise.all([supabase.from("my_profile").select("*").maybeSingle(), supabase.from("my_roles").select("*").order("granted_at")]);
  if (profile.error || roles.error) console.error("[cuenta]", profile.error?.message, roles.error?.message);

  return (
    <>
      <PageHeader title="Mi cuenta" description="Tus datos de contacto y los roles que tienes." />
      {profile.error || !profile.data ? (
        <Alert tone="error">No pudimos cargar tu perfil. Recarga la página o vuelve a ingresar.</Alert>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={profile.data.full_name} />
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-tinta">{profile.data.full_name ?? "Sin nombre"}</h2>
                <p className="truncate text-xs text-tinta-suave">{profile.data.email}</p>
              </div>
            </div>
            <ProfileForm fullName={profile.data.full_name ?? ""} phone={profile.data.phone ?? ""} save={updateProfile} />
            <p className="mt-4 text-xs text-tinta-suave">Último ingreso: {formatDateTime(profile.data.last_sign_in_at)}</p>
          </Card>
          <Card>
            <CardHeader title="Mis roles" subtitle="Lo que puedes hacer en la consola" />
            <DataTable
              caption="Mis roles"
              rows={roles.data ?? []}
              rowKey={(row) => row.id ?? ""}
              emptyTitle="No tienes roles asignados"
              columns={[
                { header: "Rol", cell: (row) => <span className="font-bold">{roleLabel[row.role ?? ""] ?? row.role}</span> },
                { header: "Estado", cell: (row) => <Badge tone={row.status === "activo" ? "positive" : row.status === "suspendido" ? "danger" : "neutral"}>{row.status === "activo" ? "Activo" : row.status === "suspendido" ? "Suspendido" : "Revocado"}</Badge> },
                { header: "Desde", cell: (row) => formatDate(row.granted_at) },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}
