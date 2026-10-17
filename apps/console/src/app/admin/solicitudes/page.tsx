import { Alert, Badge, DataTable } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { approveRequest, rejectRequest } from "./actions";
import { RequestActions } from "./request-actions";

const tone = { pendiente: "alert", aprobada: "positive", rechazada: "neutral" } as const;

export default async function SolicitudesPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("commerce_requests_list").select("*").order("created_at", { ascending: false });
  if (error) console.error("[solicitudes]", error.message);
  const rows = [...(data ?? [])].sort((a, b) => Number(b.status === "pendiente") - Number(a.status === "pendiente"));

  return (
    <>
      <PageHeader title="Solicitudes de comercio" description="Comercios que pidieron vender en Rapitrip. Las pendientes aparecen primero." />
      {error ? <Alert tone="error" className="mb-6">No pudimos cargar las solicitudes. Recarga la página.</Alert> : null}
      <DataTable
        caption="Solicitudes de comercio"
        rows={rows}
        rowKey={(row) => row.id ?? ""}
        emptyTitle="No hay solicitudes"
        emptyHint="Cuando un comercio pida vender en la tienda, aparecerá aquí."
        columns={[
          { header: "Comercio", cell: (row) => <span className="font-bold">{row.business_name}</span> },
          { header: "Recibida", cell: (row) => formatDateTime(row.created_at) },
          { header: "Estado", cell: (row) => (row.status ? <Badge tone={tone[row.status]}>{row.status}</Badge> : "—") },
          { header: "Decisión", cell: (row) => row.decision_reason ?? "—" },
          {
            header: "Acciones",
            cell: (row) =>
              row.status === "pendiente" ? <RequestActions id={row.id ?? ""} name={row.business_name ?? "este comercio"} approve={approveRequest} reject={rejectRequest} /> : "—",
          },
        ]}
      />
    </>
  );
}
