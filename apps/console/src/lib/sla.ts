/**
 * Plazos del Manual de Políticas de TI de Rapitrip. Cada uno cuenta desde que llega la solicitud o el reporte.
 *   incidencia   Control 7.2.1  una incidencia que escala el repartidor se resuelve en 30 minutos.
 *   devolucion   Norma 9.2.2    una devolución se aprueba o rechaza en 3 días hábiles.
 *   eliminacion  Norma 3.3.3    una solicitud de eliminación de datos se atiende en 30 días.
 *   errorGrave   Norma 5.2.1    un error que detiene pedidos, pagos o entregas se corrige en 4 horas.
 *   errorLeve    Norma 5.2.2    un error de una función secundaria se corrige en 3 días hábiles.
 *   aviso        Norma 3.3.4    un incidente que expone datos personales se notifica a los afectados en 72 horas.
 * Días hábiles: de lunes a viernes, en hora de Managua (UTC−6, sin horario de verano). No descuenta feriados.
 */
export type SlaKind = "incidencia" | "devolucion" | "eliminacion" | "errorGrave" | "errorLeve" | "aviso";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MANAGUA_OFFSET = -6 * HOUR;

export const slaRules: Record<SlaKind, { label: string; norm: string } & ({ ms: number } | { businessDays: number })> = {
  incidencia: { label: "30 minutos", norm: "Control 7.2.1", ms: 30 * MINUTE },
  devolucion: { label: "3 días hábiles", norm: "Norma 9.2.2", businessDays: 3 },
  eliminacion: { label: "30 días", norm: "Norma 3.3.3", ms: 30 * DAY },
  errorGrave: { label: "4 horas", norm: "Norma 5.2.1", ms: 4 * HOUR },
  errorLeve: { label: "3 días hábiles", norm: "Norma 5.2.2", businessDays: 3 },
  aviso: { label: "72 horas para avisar a los afectados", norm: "Norma 3.3.4", ms: 72 * HOUR },
};

/** Suma días hábiles (lunes a viernes, hora de Managua) conservando la hora del día. */
export function addBusinessDays(from: Date, days: number): Date {
  let local = from.getTime() + MANAGUA_OFFSET;
  let left = days;
  while (left > 0) {
    local += DAY;
    const weekday = new Date(local).getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return new Date(local - MANAGUA_OFFSET);
}

export function slaDeadline(kind: SlaKind, from: Date | string): Date {
  const start = typeof from === "string" ? new Date(from) : from;
  const rule = slaRules[kind];
  return "ms" in rule ? new Date(start.getTime() + rule.ms) : addBusinessDays(start, rule.businessDays);
}

/** El plazo de un incidente de TI: los de interrupción graves, 4 horas; los demás de interrupción, 3 días hábiles. Los de seguridad no tienen plazo de corrección en el manual. */
export function incidentSlaKind(type: string | null, severity: string | null): SlaKind | null {
  if (type !== "interrupcion") return null;
  return severity === "alta" ? "errorGrave" : "errorLeve";
}

export type SlaState = { tone: "positive" | "warning" | "danger"; text: string; overdue: boolean };

function span(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} días`;
}

/** Cómo va un plazo: a tiempo, por vencer (queda la cuarta parte o menos) o vencido. */
export function slaState(kind: SlaKind, from: Date | string, now: Date = new Date()): SlaState {
  const start = typeof from === "string" ? new Date(from) : from;
  const deadline = slaDeadline(kind, start);
  const left = deadline.getTime() - now.getTime();
  if (left <= 0) return { tone: "danger", text: `Vencido hace ${span(-left)}`, overdue: true };
  const total = deadline.getTime() - start.getTime();
  return { tone: left <= total / 4 ? "warning" : "positive", text: `Vence en ${span(left)}`, overdue: false };
}

export function isOverdue(kind: SlaKind, from: Date | string, now: Date = new Date()): boolean {
  return slaDeadline(kind, from).getTime() <= now.getTime();
}
