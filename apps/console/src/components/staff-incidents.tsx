"use client";

import { Alert, Badge, Button, Card, SelectField, TextareaField, cn } from "@rapitrip/ui";
import { Bug, CheckCircle2, History, LifeBuoy, Send, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-error";
import { formatDateTime } from "@/lib/format";

type IncidentType = "interrupcion" | "seguridad";
type Severity = "baja" | "media" | "alta";
type Status = "abierto" | "en_atencion" | "resuelto";

export type MyIncident = { id: string; type: IncidentType; severity: Severity; description: string; status: Status; resolution: string | null; reportedFrom: string | null; createdAt: string };

/** Los dos tipos de incidente de TI, dichos como los vive quien trabaja en la consola. */
const types: { value: IncidentType; label: string; text: string; icon: ReactNode }[] = [
  { value: "interrupcion", label: "El sistema falla", text: "Algo no carga, no guarda, se traba o da un error.", icon: <Bug className="size-5" /> },
  { value: "seguridad", label: "Seguridad", text: "Un acceso raro, un correo sospechoso o datos expuestos.", icon: <ShieldAlert className="size-5" /> },
];

/** La gravedad medida por cuánto le impide trabajar. «Grave» avisa por correo a la administración al instante. */
const severities: { value: Severity; label: string; text: string; tone: string }[] = [
  { value: "baja", label: "Leve", text: "Molesta, pero puedo trabajar.", tone: "has-[:checked]:bg-menta has-[:checked]:ring-hoja" },
  { value: "media", label: "Media", text: "Algo no funciona; lo estoy rodeando.", tone: "has-[:checked]:bg-durazno has-[:checked]:ring-naranja" },
  { value: "alta", label: "Grave", text: "No puedo trabajar o hay riesgo de seguridad.", tone: "has-[:checked]:bg-rosa has-[:checked]:ring-rojo" },
];

const statusLabel: Record<Status, string> = { abierto: "Recibido", en_atencion: "En atención", resuelto: "Resuelto" };
const statusTone = { abierto: "warning", en_atencion: "neutral", resuelto: "positive" } as const;
const severityLabel: Record<Severity, string> = { baja: "Leve", media: "Media", alta: "Grave" };

type Report = (input: { type: IncidentType; severity: Severity | undefined; where?: string; description: string }) => Promise<ActionResult>;

/** «Reportar incidente» de caja, coordinación y comercio: el formulario a la izquierda y lo ya reportado, con su estado, a la derecha. */
export function StaffIncidents({ places, mine, report }: { places: string[]; mine: MyIncident[]; report: Report }) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="p-5 sm:p-6">
        <Heading icon={<LifeBuoy className="size-[18px]" />} title="Nuevo reporte" subtitle="Llega a la administración en «Incidentes de TI». Mientras más detalle, más rápido se resuelve." />
        <ReportForm places={places} report={report} />
      </Card>
      <Card className="p-5 xl:sticky xl:top-6">
        <Heading icon={<History className="size-[18px]" />} tone="lavanda" title="Mis reportes" subtitle="Lo que enviaste y en qué va." />
        {mine.length === 0 ? (
          <p className="rounded-panel border border-dashed border-borde-campo px-4 py-6 text-center text-[13px] text-tinta-suave">Todavía no has reportado incidentes.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {mine.map((item) => (
              <li key={item.id} className="rounded-panel bg-papel p-3.5 ring-1 ring-borde">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11.5px] font-bold text-tinta-suave">#{item.id.slice(0, 8).toUpperCase()}</span>
                  <Badge tone={statusTone[item.status]}>{statusLabel[item.status]}</Badge>
                </div>
                <p className="line-clamp-2 text-[13px] font-semibold text-tinta">{item.description}</p>
                <p className="mt-1 text-[11.5px] text-tinta-suave">
                  {formatDateTime(item.createdAt)} · {item.type === "seguridad" ? "Seguridad" : "Falla"} · {severityLabel[item.severity]}
                  {item.reportedFrom ? ` · ${item.reportedFrom}` : ""}
                </p>
                {item.status === "resuelto" && item.resolution ? (
                  <p className="mt-2 rounded-xl bg-menta/60 px-3 py-2 text-[12px] text-tinta">
                    <span className="font-bold">Resolución: </span>
                    {item.resolution}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Heading({ icon, title, subtitle, tone = "menta" }: { icon: ReactNode; title: string; subtitle: string; tone?: "menta" | "lavanda" }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", tone === "menta" ? "bg-menta text-hoja" : "bg-lavanda text-marino")}>
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-tinta">{title}</h2>
        <p className="mt-0.5 text-[12.5px] leading-snug text-tinta-suave">{subtitle}</p>
      </div>
    </div>
  );
}

function ReportForm({ places, report }: { places: string[]; report: Report }) {
  const router = useRouter();
  const [type, setType] = useState<IncidentType>("interrupcion");
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [where, setWhere] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const ready = severity !== null && description.trim().length >= 10;

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!severity) return setError("Elige cuánto te afecta.");
    start(async () => {
      const result = await report({ type, severity, description: description.trim(), ...(where ? { where } : {}) });
      if (!result.ok) return setError(result.error);
      setSeverity(null);
      setWhere("");
      setDescription("");
      setSent(true);
      router.refresh();
    });
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-panel bg-menta/60 px-5 py-8 text-center ring-1 ring-menta-borde">
        <CheckCircle2 aria-hidden="true" className="size-10 text-hoja" />
        <div>
          <p className="text-[16px] font-bold text-tinta">Reporte enviado</p>
          <p className="mt-0.5 text-[13px] text-tinta-suave">La administración ya lo ve. Sigue su estado en «Mis reportes».</p>
        </div>
        <Button variant="ghost" onClick={() => setSent(false)}>
          Reportar otro incidente
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset>
        <legend className="mb-2 text-[13px] font-bold text-tinta">¿Qué pasó?</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {types.map((item) => (
            <label
              key={item.value}
              className="relative flex cursor-pointer items-start gap-3 rounded-panel bg-papel p-4 ring-1 ring-borde transition-[background-color,box-shadow] duration-300 ease-fluido hover:ring-menta-borde has-[:checked]:bg-menta/60 has-[:checked]:ring-2 has-[:checked]:ring-hoja has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hoja"
            >
              <input type="radio" name="tipo-incidente" value={item.value} checked={type === item.value} onChange={() => setType(item.value)} className="sr-only" />
              <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", type === item.value ? "bg-hoja text-sobre-acento" : "bg-crema text-hoja")}>
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-tinta">{item.label}</span>
                <span className="block text-[12.5px] leading-snug text-tinta-suave">{item.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] font-bold text-tinta">¿Cuánto te afecta?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {severities.map((item) => (
            <label key={item.value} className={cn("relative flex cursor-pointer items-start gap-2.5 rounded-panel bg-papel px-3.5 py-3 ring-1 ring-borde transition-colors duration-300 ease-fluido has-[:checked]:ring-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hoja", item.tone)}>
              <input type="radio" name="gravedad-incidente" value={item.value} checked={severity === item.value} onChange={() => setSeverity(item.value)} className="sr-only" />
              <span aria-hidden="true" className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ring-2", severity === item.value ? "ring-tinta" : "ring-borde-campo")}>
                {severity === item.value ? <span className="size-2 rounded-full bg-tinta" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold text-tinta">{item.label}</span>
                <span className="block text-[12px] leading-snug text-tinta-suave">{item.text}</span>
              </span>
            </label>
          ))}
        </div>
        {severity === "alta" ? <p className="mt-2 text-[12.5px] font-semibold text-rojo">Un reporte grave avisa por correo a la administración de inmediato.</p> : null}
      </fieldset>

      <SelectField label="¿Dónde pasó? (opcional)" value={where} onChange={(e) => setWhere(e.target.value)}>
        <option value="">Elige la pantalla</option>
        {places.map((place) => (
          <option key={place} value={place}>
            {place}
          </option>
        ))}
      </SelectField>

      <TextareaField
        label="Cuéntanos qué pasó"
        rows={5}
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Qué estabas haciendo, qué esperabas y qué salió. Si hubo un mensaje de error, cópialo."
        required
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex flex-col gap-3 border-t border-borde pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-tinta-suave">{description.trim().length < 10 ? `Mínimo 10 caracteres (${description.trim().length}/10)` : `${description.trim().length}/2000 caracteres`}</p>
        <Button variant="primary" type="submit" disabled={pending || !ready}>
          <Send className="size-4" aria-hidden="true" />
          {pending ? "Enviando…" : "Enviar reporte"}
        </Button>
      </div>
    </form>
  );
}
