import { Alert, Badge, DataTable } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { SlaBadge } from "@/components/sla-badge";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { sourceLabel } from "@/lib/incidents";
import { incidentSlaKind } from "@/lib/sla";
import { serverSupabase } from "@/lib/supabase";
import { recordIncidentNotice, reportIncident, setIncidentStatus } from "./actions";
import { IncidentActions, RecordNotice, ReportIncident } from "./incident-controls";

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
          {
            header: "Origen",
            // Los que mandan el repartidor (Ayuda) o caja, coordinación y comercio («Reportar incidente») dicen quién y desde qué pantalla.
            cell: (row) =>
              row.source && sourceLabel[row.source] ? (
                <span className="flex flex-col">
                  <span className="font-semibold">{sourceLabel[row.source]}</span>
                  {row.reporter_name || row.reported_from ? (
                    <span className="text-xs text-tinta-suave">{[row.reporter_name, row.reported_from].filter(Boolean).join(" · ")}</span>
                  ) : null}
                </span>
              ) : row.origin === "automatico" ? (
                "Automático"
              ) : (
                "Manual"
              ),
          },
          { header: "Gravedad", cell: (row) => (row.severity ? <Badge tone={severityTone[row.severity]}>{{ baja: "Baja", media: "Media", alta: "Alta" }[row.severity]}</Badge> : "—") },
          {
            header: "Descripción",
            cell: (row) => (
              <span className="flex max-w-sm flex-col gap-0.5">
                <span className="line-clamp-2">{row.description}</span>
                {/* Norma 1.3.2: lo que pide el manual a un incidente de seguridad. */}
                {row.data_involved || row.affected ? (
                  <span className="text-xs text-tinta-suave">
                    {[row.data_involved ? `Información: ${row.data_involved}` : null, row.affected ? `Afectados: ${row.affected}` : null].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                {row.occurred_at ? <span className="text-xs text-tinta-suave">Ocurrió: {formatDateTime(row.occurred_at)}</span> : null}
              </span>
            ),
          },
          { header: "Estado", cell: (row) => (row.status ? <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge> : "—") },
          {
            header: "Plazo",
            // Norma 5.2: un error que detiene pedidos, pagos o entregas (grave) se corrige en 4 horas; el resto, en 3 días hábiles.
            cell: (row) => {
              // Norma 3.3.4: un incidente de seguridad que expone datos se avisa a los afectados en 72 horas.
              if (row.type === "seguridad") {
                if (row.notified_at) return <span className="text-xs text-tinta-suave">Avisados el {formatDateTime(row.notified_at)}{row.notice_channel ? ` · ${row.notice_channel}` : ""}</span>;
                if ((row.data_involved || row.affected) && row.created_at) return <SlaBadge kind="aviso" from={row.occurred_at ?? row.created_at} />;
                return <span className="text-xs text-tinta-suave">—</span>;
              }
              const kind = incidentSlaKind(row.type, row.severity);
              if (!kind || !row.created_at) return <span className="text-xs text-tinta-suave">—</span>;
              if (row.status === "resuelto") return <span className="text-xs text-tinta-suave">Cerrado</span>;
              return <SlaBadge kind={kind} from={row.created_at} />;
            },
          },
          {
            header: "Acciones",
            cell: (row) =>
              row.status ? (
                <span className="flex flex-wrap items-center gap-1">
                  <IncidentActions id={row.id ?? ""} status={row.status} setStatus={setIncidentStatus} />
                  {row.type === "seguridad" && !row.notified_at && (row.data_involved || row.affected) ? <RecordNotice id={row.id ?? ""} record={recordIncidentNotice} /> : null}
                </span>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </>
  );
}
