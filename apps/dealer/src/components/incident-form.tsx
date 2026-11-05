"use client";

import { Alert, cn, Field, TextareaField } from "@rapitrip/ui";
import { Bug, CheckCircle2, Send, ShieldAlert, Smartphone } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { useAuthGuard } from "@/lib/use-auth-guard";

type IncidentType = "interrupcion" | "seguridad";
type Severity = "baja" | "media" | "alta";

/** Los dos tipos de incidente de TI de la consola, dichos como los vive el repartidor. */
const types: { value: IncidentType; label: string; text: string; icon: ReactNode }[] = [
  { value: "interrupcion", label: "La app falla", text: "Algo no carga, no guarda o se cierra.", icon: <Bug className="size-5" /> },
  { value: "seguridad", label: "Mi cuenta", text: "Un acceso raro, perdí el teléfono o algo sospechoso.", icon: <ShieldAlert className="size-5" /> },
];

/** Dónde pasó: las pantallas de la app, para que el equipo de TI vaya directo al lugar. */
const places = ["Inicio", "Propuesta", "Detalle del pedido", "Fotos y códigos", "Historial", "Avisos", "Ajustes", "Ingreso", "Otro"] as const;

/** La gravedad de la consola, medida por cuánto le afecta trabajar. «Alta» avisa al equipo por correo al instante. */
const severities: { value: Severity; label: string; text: string; tone: string }[] = [
  { value: "baja", label: "Leve", text: "Molesta, pero puedo trabajar.", tone: "has-[:checked]:bg-menta has-[:checked]:ring-hoja" },
  { value: "media", label: "Media", text: "Algo no funciona; lo estoy rodeando.", tone: "has-[:checked]:bg-durazno has-[:checked]:ring-naranja" },
  { value: "alta", label: "Grave", text: "No puedo trabajar o mi cuenta corre riesgo.", tone: "has-[:checked]:bg-rosa has-[:checked]:ring-rojo" },
];

/** Datos del teléfono que ayudan a reproducir el fallo: navegador, pantalla y conexión. Nada personal. */
export function deviceSummary(): string {
  if (typeof navigator === "undefined") return "";
  const standalone = typeof matchMedia !== "undefined" && matchMedia("(display-mode: standalone)").matches;
  return [navigator.userAgent, `${screen.width}x${screen.height}`, standalone ? "instalada" : "navegador", navigator.onLine ? "en línea" : "sin conexión"].join(" · ");
}

type Result = { ok: true; ticket: string } | { ok: false; error: string };

/**
 * Reporte de incidente de TI desde la app: tipo, dónde pasó, cuánto afecta y qué pasó. Usa `courier_report_incident`, que lo
 * guarda en los mismos «Incidentes de TI» de la consola (los graves avisan por correo a la administración).
 */
export function IncidentForm() {
  const supabase = getSupabase();
  const guard = useAuthGuard();
  const [type, setType] = useState<IncidentType>("interrupcion");
  const [place, setPlace] = useState<(typeof places)[number] | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [description, setDescription] = useState("");
  // Norma 1.3.2 del manual de políticas de TI: en un incidente de seguridad, qué información y a quiénes afecta.
  const [dataInvolved, setDataInvolved] = useState("");
  const [affected, setAffected] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);
  const security = type === "seguridad";
  const ready = description.trim().length >= 10 && severity !== null && (!security || (dataInvolved.trim() !== "" && affected.trim() !== ""));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    if (!severity) return setResult({ ok: false, error: "Elige cuánto te afecta." });
    if (description.trim().length < 10) return setResult({ ok: false, error: "Describe el incidente con al menos 10 caracteres." });
    setPending(true);
    const { data, error } = await supabase.rpc("courier_report_incident", {
      p_type: type,
      p_severity: severity,
      p_description: description.trim(),
      ...(place ? { p_where: place } : {}),
      p_device: deviceSummary(),
      ...(security ? { p_data_involved: dataInvolved.trim(), p_affected: affected.trim() } : {}),
    });
    setPending(false);
    if (error) {
      if (!guard(error)) setResult({ ok: false, error: friendlyError(error, "No pudimos enviar el reporte. Inténtalo de nuevo.") });
      return;
    }
    setPlace(null);
    setSeverity(null);
    setDescription("");
    setDataInvolved("");
    setAffected("");
    setResult({ ok: true, ticket: String(data ?? "").slice(0, 8).toUpperCase() });
  }

  if (result?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-menta/60 px-5 py-6 text-center ring-1 ring-menta-borde" role="status">
        <CheckCircle2 aria-hidden="true" className="size-10 text-hoja" />
        <div>
          <p className="text-[16px] font-bold text-tinta">Reporte enviado</p>
          <p className="mt-0.5 text-[13px] text-tinta-suave">
            Número <span className="font-mono font-bold text-tinta">#{result.ticket}</span>. Lo revisa el equipo de TI de Rapitrip.
          </p>
        </div>
        <button type="button" onClick={() => setResult(null)} className="min-h-11 rounded-full px-5 text-[13.5px] font-bold text-hoja underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-hoja">
          Reportar otro incidente
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset>
        <legend className="mb-2 px-1 text-[13px] font-bold text-tinta">¿Qué pasó?</legend>
        <div className="grid grid-cols-2 gap-2">
          {types.map((item) => (
            <label
              key={item.value}
              className="relative flex cursor-pointer flex-col gap-1.5 rounded-2xl bg-crema p-3 ring-1 ring-borde transition-[background-color,box-shadow] duration-300 ease-fluido has-[:checked]:bg-menta/60 has-[:checked]:ring-2 has-[:checked]:ring-hoja has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hoja"
            >
              <input type="radio" name="tipo-incidente" value={item.value} checked={type === item.value} onChange={() => setType(item.value)} className="sr-only" />
              <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-xl", type === item.value ? "bg-hoja text-sobre-acento" : "bg-superficie text-hoja")}>
                {item.icon}
              </span>
              <span className="text-[14px] font-bold text-tinta">{item.label}</span>
              <span className="text-[12px] leading-snug text-tinta-suave">{item.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 px-1 text-[13px] font-bold text-tinta">
          ¿Dónde pasó? <span className="font-medium text-tinta-suave">(opcional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {places.map((item) => (
            <label key={item} className="relative cursor-pointer rounded-full bg-crema px-3.5 py-2 text-[13px] font-semibold text-tinta ring-1 ring-borde transition-colors duration-300 ease-fluido has-[:checked]:bg-selva has-[:checked]:text-sobre-acento has-[:checked]:ring-selva has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hoja">
              <input type="radio" name="lugar-incidente" value={item} checked={place === item} onChange={() => setPlace(item)} className="sr-only" />
              {item}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 px-1 text-[13px] font-bold text-tinta">¿Cuánto te afecta?</legend>
        <div className="flex flex-col gap-2">
          {severities.map((item) => (
            <label key={item.value} className={cn("relative flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-crema px-4 py-2.5 ring-1 ring-borde transition-colors duration-300 ease-fluido has-[:checked]:ring-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hoja", item.tone)}>
              <input type="radio" name="gravedad-incidente" value={item.value} checked={severity === item.value} onChange={() => setSeverity(item.value)} className="sr-only" />
              <span aria-hidden="true" className={cn("flex size-5 shrink-0 items-center justify-center rounded-full ring-2", severity === item.value ? "ring-tinta" : "ring-borde-campo")}>
                {severity === item.value ? <span className="size-2.5 rounded-full bg-tinta" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-bold text-tinta">{item.label}</span>
                <span className="block text-[12.5px] text-tinta-suave">{item.text}</span>
              </span>
            </label>
          ))}
        </div>
        {severity === "alta" ? <p className="mt-2 px-1 text-[12.5px] font-semibold text-rojo">Un reporte grave avisa por correo al equipo de inmediato.</p> : null}
      </fieldset>

      {/* `text-base` (16px): con menos, Safari del iPhone amplía la página al enfocar el campo. */}
      <TextareaField
        label="Cuéntanos qué pasó"
        className="text-base"
        rows={4}
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Qué estabas haciendo, qué esperabas y qué salió (si hubo un mensaje de error, cópialo)."
        required
      />

      {security ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-durazno/40 p-4 ring-1 ring-borde">
          <p className="text-[12.5px] leading-snug text-tinta">Repórtalo en un máximo de 24 horas e indica qué información y a quiénes afecta.</p>
          <Field label="¿Qué información está involucrada?" className="text-base" value={dataInvolved} maxLength={300} onChange={(e) => setDataInvolved(e.target.value)} placeholder="Tu contraseña, datos de un cliente…" required />
          <Field label="¿Quiénes están afectados?" className="text-base" value={affected} maxLength={300} onChange={(e) => setAffected(e.target.value)} placeholder="Tu cuenta, un cliente…" required />
        </div>
      ) : null}

      <p className="flex items-start gap-2 px-1 text-[12px] leading-snug text-tinta-suave">
        <Smartphone aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        Se adjunta el modelo de navegador, el tamaño de pantalla y si tenías conexión, para reproducir el fallo. Nada de tus pedidos ni de tus datos.
      </p>

      {result && !result.ok ? <Alert tone="error">{result.error}</Alert> : null}
      <button
        type="submit"
        disabled={pending || !ready}
        className="group inline-flex min-h-12 items-center justify-between gap-2 rounded-full bg-selva py-1.5 pl-6 pr-1.5 text-[14px] font-bold text-sobre-acento shadow-pulsa transition-[background-color,transform] duration-500 ease-fluido hover:bg-tinta active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
      >
        {pending ? "Enviando…" : "Enviar reporte"}
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-esmeralda text-panel transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
          <Send className="size-4" />
        </span>
      </button>
    </form>
  );
}
