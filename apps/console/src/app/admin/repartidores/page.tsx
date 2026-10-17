import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDate } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { courierDocumentUrl, createCourier, setCourierStatus, updateCourierById } from "./actions";
import { CouriersWorkspace, type CourierRow } from "./couriers-workspace";

export default async function RepartidoresPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("couriers_list").select("*").order("full_name");
  if (error) console.error("[repartidores]", error.message);

  const rows: CourierRow[] = (data ?? []).flatMap((row) =>
    row.id ? [{ id: row.id, name: row.full_name ?? "Sin nombre", phone: row.phone ?? "—", vehicle: row.vehicle_type ?? "—", status: row.status === "activo" ? ("activo" as const) : ("inactivo" as const), since: formatDate(row.created_at) }] : [],
  );

  return (
    <>
      <PageHeader title="Repartidores" description="Prestadores de servicio: alta, datos y activación." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar los repartidores. Recarga la página.</Alert> : null}
      <CouriersWorkspace rows={rows} create={createCourier} update={updateCourierById} setStatus={setCourierStatus} documentUrl={courierDocumentUrl} />
    </>
  );
}
