import { Alert, Avatar, Badge, DataTable } from "@rapitrip/ui";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { formatDate } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

export default async function ComerciosPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [commerces, accounts, stores] = await Promise.all([
    supabase.from("commerces_list").select("*").order("created_at", { ascending: false }),
    supabase.from("accounts_staff").select("user_id, commerce_id, role_status").eq("role", "comercio"),
    supabase.from("stores_list").select("id, commerce_id, status"),
  ]);
  const failed = commerces.error || accounts.error || stores.error;
  if (failed) console.error("[comercios]", commerces.error?.message, accounts.error?.message, stores.error?.message);
  const storeCount = new Map<string, number>();
  for (const row of stores.data ?? []) {
    if (row.commerce_id && row.status === "activa") storeCount.set(row.commerce_id, (storeCount.get(row.commerce_id) ?? 0) + 1);
  }

  const activeUsers = new Map<string, number>();
  for (const row of accounts.data ?? []) {
    if (row.commerce_id && row.role_status === "activo") activeUsers.set(row.commerce_id, (activeUsers.get(row.commerce_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title="Comercios y tiendas" description="Comercios aprobados en Rapitrip y sus tiendas activas. El catálogo llega en las siguientes etapas de la Fase 2." />
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
              <Link href={`/admin/comercios/${row.id}`} className="flex items-center gap-2.5 rounded-campo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                <Avatar name={row.name} size="sm" />
                <span className="font-bold underline-offset-2 hover:underline">{row.name}</span>
              </Link>
            ),
          },
          { header: "Estado", cell: (row) => <Badge tone={row.status === "activo" ? "positive" : "danger"}>{row.status === "activo" ? "Activo" : "Suspendido"}</Badge> },
          { header: "Tiendas activas", cell: (row) => <span className="tabular-nums">{storeCount.get(row.id ?? "") ?? 0}</span> },
          { header: "Cuentas activas", cell: (row) => <span className="tabular-nums">{activeUsers.get(row.id ?? "") ?? 0}</span> },
          { header: "Alta", cell: (row) => formatDate(row.created_at) },
        ]}
      />
    </>
  );
}
