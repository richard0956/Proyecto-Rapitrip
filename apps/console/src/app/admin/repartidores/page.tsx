import { Alert, Badge, DataTable } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDate } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { courierDocumentUrl, createCourier, setCourierStatus, updateCourierById } from "./actions";
import { CourierActions } from "./courier-actions";
import { CourierForm } from "./courier-form";

export default async function RepartidoresPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("couriers_list").select("*").order("full_name");
  if (error) console.error("[repartidores]", error.message);

  return (
    <>
      <PageHeader
        title="Repartidores"
        description="Personas que hacen las entregas. El documento se abre con un enlace temporal y cada lectura queda auditada."
        actions={<CourierForm primary triggerLabel="Nuevo repartidor" title="Nuevo repartidor" submit={createCourier} />}
      />
      {error ? <Alert tone="error" className="mb-6">No pudimos cargar los repartidores. Recarga la página.</Alert> : null}
      <DataTable
        caption="Repartidores"
        rows={data ?? []}
        rowKey={(row) => row.id ?? ""}
        emptyTitle="Todavía no hay repartidores"
        emptyHint="Crea el primero con «Nuevo repartidor»."
        columns={[
          { header: "Nombre", cell: (row) => <span className="font-bold">{row.full_name}</span> },
          { header: "Teléfono", cell: (row) => row.phone },
          { header: "Vehículo", cell: (row) => row.vehicle_type },
          { header: "Estado", cell: (row) => <Badge tone={row.status === "activo" ? "positive" : "neutral"}>{row.status}</Badge> },
          { header: "Alta", cell: (row) => formatDate(row.created_at) },
          {
            header: "Acciones",
            cell: (row) => (
              <div className="flex flex-wrap items-center gap-1">
                <CourierForm
                  triggerLabel="Editar"
                  ariaLabel={`Editar a ${row.full_name}`}
                  title="Editar repartidor"
                  initial={{ full_name: row.full_name ?? "", phone: row.phone ?? "", vehicle_type: row.vehicle_type ?? "" }}
                  submit={updateCourierById.bind(null, row.id ?? "")}
                />
                <CourierActions id={row.id ?? ""} name={row.full_name ?? "este repartidor"} status={row.status ?? "inactivo"} setStatus={setCourierStatus} documentUrl={courierDocumentUrl} />
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
