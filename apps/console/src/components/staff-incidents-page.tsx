import { Alert } from "@rapitrip/ui";
import { requireConsoleAccess } from "@/lib/guard";
import { reportStaffIncident } from "@/lib/incident-actions";
import { placesFor, type ReportingArea } from "@/lib/incidents";
import { serverSupabase } from "@/lib/supabase";
import { PageHeader } from "./shell";
import { StaffIncidents, type MyIncident } from "./staff-incidents";

/** Pantalla «Reportar incidente», igual en caja, coordinación y comercio; cada una entra con su propia área. */
export async function StaffIncidentsPage({ area }: { area: ReportingArea }) {
  await requireConsoleAccess(area);
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("my_incidents");
  if (error) console.error("[incidentes:propios]", error.message);
  const mine: MyIncident[] = (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    severity: row.severity,
    description: row.description,
    status: row.status,
    resolution: row.resolution,
    reportedFrom: row.reported_from,
    createdAt: row.created_at,
  }));

  return (
    <>
      <PageHeader title="Reportar incidente" description="¿Algo del sistema falla o viste algo sospechoso? Avísale a la administración; te respondemos aquí mismo." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar tus reportes anteriores. Puedes enviar uno nuevo igual.</Alert> : null}
      <StaffIncidents places={placesFor(area)} mine={mine} report={reportStaffIncident} />
    </>
  );
}
