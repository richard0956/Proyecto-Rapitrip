export type PeriodKey = "hoy" | "7d" | "quincena" | "mes";

export type Period = { key: PeriodKey; label: string; from: string; to: string; prevFrom: string; prevTo: string; days: number };

export const periodOptions: { key: PeriodKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "quincena", label: "Quincena" },
  { key: "mes", label: "Mes" },
];

/** Costa Rica no tiene horario de verano: UTC−6 todo el año (igual que `startOfTodayIso` en `orders.ts`). */
const OFFSET_HOURS = 6;
const DAY_MS = 86_400_000;

/** Medianoche local de (año, mes, día) expresada como instante UTC. Acepta días fuera de rango (se normalizan). */
const localMidnight = (year: number, month: number, day: number) => Date.UTC(year, month, day, OFFSET_HOURS);

function localParts(now: Date) {
  const shifted = new Date(now.getTime() - OFFSET_HOURS * 3_600_000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

export function parsePeriod(raw: string | undefined, now: Date = new Date()): Period {
  const key: PeriodKey = periodOptions.some((option) => option.key === raw) ? (raw as PeriodKey) : "mes";
  const { year, month, day } = localParts(now);
  const label = periodOptions.find((option) => option.key === key)!.label;
  let from: number;
  let to: number;
  let prevFrom: number;
  if (key === "hoy") {
    from = localMidnight(year, month, day);
    to = localMidnight(year, month, day + 1);
    prevFrom = from - DAY_MS;
  } else if (key === "7d") {
    from = localMidnight(year, month, day - 6);
    to = localMidnight(year, month, day + 1);
    prevFrom = from - 7 * DAY_MS;
  } else if (key === "quincena") {
    const firstHalf = day <= 15;
    from = localMidnight(year, month, firstHalf ? 1 : 16);
    to = firstHalf ? localMidnight(year, month, 16) : localMidnight(year, month + 1, 1);
    prevFrom = firstHalf ? localMidnight(year, month - 1, 16) : localMidnight(year, month, 1);
  } else {
    from = localMidnight(year, month, 1);
    to = localMidnight(year, month + 1, 1);
    prevFrom = localMidnight(year, month - 1, 1);
  }
  return {
    key,
    label,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    prevFrom: new Date(prevFrom).toISOString(),
    prevTo: new Date(from).toISOString(),
    days: Math.round((to - from) / DAY_MS),
  };
}

export function delta(current: number, previous: number): { pct: number | null; direction: "up" | "down" | "flat" } {
  if (previous === 0) return { pct: null, direction: current > 0 ? "up" : "flat" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, direction: current > previous ? "up" : current < previous ? "down" : "flat" };
}

/** Estimación simple: promedio diario del mes en curso por los días del mes. */
export function projectMonthEnd(salesToDate: number, now: Date = new Date()): number {
  const { year, month, day } = localParts(now);
  return (salesToDate / day) * daysInMonth(year, month);
}

/** Una fila por día local entre `from` y `to` (exclusivo); los días sin datos valen 0. `day` es `YYYY-MM-DD`. */
export function fillDays(rows: { day: string; value: number }[], from: string, to: string): { day: string; value: number }[] {
  const byDay = new Map(rows.map((row) => [row.day, row.value]));
  const out: { day: string; value: number }[] = [];
  const end = new Date(to).getTime();
  for (let t = new Date(from).getTime(); t < end; t += DAY_MS) {
    const day = new Date(t - OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
    out.push({ day, value: byDay.get(day) ?? 0 });
  }
  return out;
}

const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });

/** Dinero corto para los ejes y la tabla de lectura de los gráficos: «C$ 1,5 mil». */
export const compactMoney = (n: number) => `C$ ${compact.format(n)}`;

/** Minutos (redondeados hacia arriba) que faltan para `iso`; 0 si ya pasó y `null` si no hay plazo. */
export function minutesUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60_000));
}

/** Los primeros `count` días locales desde `from`: para comparar contra lo equivalente del periodo anterior, no contra todo. */
export function firstDays<T extends { day: string }>(rows: T[], from: string, count: number): T[] {
  const days = new Set(fillDays([], from, new Date(new Date(from).getTime() + Math.max(0, count) * DAY_MS).toISOString()).map((point) => point.day));
  return rows.filter((row) => days.has(row.day));
}

/** Texto de la tendencia de una tarjeta. Sin periodo anterior con datos no se inventa un porcentaje ni una flecha. */
export function trendOf(current: number, previous: number, vs: string): { direction: "up" | "down" | "flat"; text: string } {
  const change = delta(current, previous);
  if (change.pct === null) return { direction: "flat", text: `Sin comparación con ${vs}` };
  const arrow = change.direction === "up" ? "▲" : change.direction === "down" ? "▼" : "=";
  return { direction: change.direction, text: `${arrow} ${Math.abs(change.pct)} % vs ${vs}` };
}
