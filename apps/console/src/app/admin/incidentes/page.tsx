import { Alert, Badge, DataTable } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { reportIncident, setIncidentStatus } from "./actions";
import { IncidentActions, ReportIncident } from "./incident-controls";

const severityTone = { baja: "neutral", media: "warning", alta: "danger" } as const;
const statusTone = { abierto: "warning", en_atencion: "neutral", resuelto: "positive" } as const;
const statusLabel = { abierto: "Abierto", en_atencion: "En atención", resuelto: "Resuelto" } as const;

export default async function IncidentesPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("it_incidents_list").select("*").order("created_at", { ascending: false });
  if (error) console.error("[incidentes]", error.message);

  return (
    <>
      <PageHeader title="Incidentes de TI" description="Interrupciones y eventos de seguridad, manuales o detectados por el sistema." actions={<ReportIncident report={reportIncident} />} />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar los incidentes. Recarga la página.</Alert> : null}
      <DataTable
        caption="Incidentes de TI"
        rows={data ?? []}
        rowKey={(row) => row.id ?? ""}
        emptyTitle="No hay incidentes registrados"
        columns={[
          { header: "Fecha", cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.created_at)}</span> },
          { header: "Tipo", cell: (row) => (row.type === "seguridad" ? "Seguridad" : "Interrupción") },
          { header: "Origen", cell: (row) => (row.origin === "automatico" ? "Automático" : "Manual") },
          { header: "Gravedad", cell: (row) => (row.severity ? <Badge tone={severityTone[row.severity]}>{{ baja: "Baja", media: "Media", alta: "Alta" }[row.severity]}</Badge> : "—") },
          { header: "Descripción", cell: (row) => <span className="line-clamp-2 max-w-sm">{row.description}</span> },
          { header: "Estado", cell: (row) => (row.status ? <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge> : "—") },
          { header: "Acciones", cell: (row) => (row.status ? <IncidentActions id={row.id ?? ""} status={row.status} setStatus={setIncidentStatus} /> : "—") },
        ]}
      />
    </>
  );
}
