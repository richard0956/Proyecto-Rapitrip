import { Alert, Avatar, Badge, DataTable } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDate } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

export default async function ComerciosPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [commerces, accounts] = await Promise.all([
    supabase.from("commerces_list").select("*").order("created_at", { ascending: false }),
    supabase.from("accounts_staff").select("user_id, commerce_id, role_status").eq("role", "comercio"),
  ]);
  const failed = commerces.error || accounts.error;
  if (failed) console.error("[comercios]", commerces.error?.message, accounts.error?.message);

  const activeUsers = new Map<string, number>();
  for (const row of accounts.data ?? []) {
    if (row.commerce_id && row.role_status === "activo") activeUsers.set(row.commerce_id, (activeUsers.get(row.commerce_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title="Comercios y tiendas" description="Comercios aprobados en Rapitrip. Las tiendas y su catálogo llegan con las siguientes fases." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar los comercios. Recarga la página.</Alert> : null}
      <DataTable
        caption="Comercios"
        rows={commerces.data ?? []}
        rowKey={(row) => row.id ?? ""}
        emptyTitle="Todavía no hay comercios"
        emptyHint="Aparecen aquí cuando apruebas una solicitud de comercio."
        columns={[
          {
            header: "Comercio",
            cell: (row) => (
              <span className="flex items-center gap-2.5">
                <Avatar name={row.name} size="sm" />
                <span className="font-bold">{row.name}</span>
              </span>
            ),
          },
          { header: "Estado", cell: (row) => <Badge tone={row.status === "activo" ? "positive" : "danger"}>{row.status === "activo" ? "Activo" : "Suspendido"}</Badge> },
          { header: "Cuentas activas", cell: (row) => <span className="tabular-nums">{activeUsers.get(row.id ?? "") ?? 0}</span> },
          { header: "Alta", cell: (row) => formatDate(row.created_at) },
        ]}
      />
    </>
  );
}
