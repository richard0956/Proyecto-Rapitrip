import { Alert, Badge, Card, DataTable } from "@rapitrip/ui";
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
        <div className="flex flex-col gap-8">
          <Card>
            <h2 className="mb-1 font-titulo text-xl text-selva">Datos personales</h2>
            <p className="mb-4 text-sm text-tinta-suave">
              Correo: <strong className="text-tinta">{profile.data.email}</strong>. Último ingreso: {formatDateTime(profile.data.last_sign_in_at)}.
            </p>
            <ProfileForm fullName={profile.data.full_name ?? ""} phone={profile.data.phone ?? ""} save={updateProfile} />
          </Card>
          <section aria-labelledby="mis-roles">
            <h2 id="mis-roles" className="mb-3 font-titulo text-xl text-selva">
              Mis roles
            </h2>
            <DataTable
              caption="Mis roles"
              rows={roles.data ?? []}
              rowKey={(row) => row.id ?? ""}
              emptyTitle="No tienes roles asignados"
              columns={[
                { header: "Rol", cell: (row) => roleLabel[row.role ?? ""] ?? row.role },
                { header: "Estado", cell: (row) => <Badge tone={row.status === "activo" ? "positive" : "neutral"}>{row.status}</Badge> },
                { header: "Desde", cell: (row) => formatDate(row.granted_at) },
              ]}
            />
          </section>
        </div>
      )}
    </>
  );
}
