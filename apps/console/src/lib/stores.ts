/** Utilidades de tiendas: el horario se muestra siempre en hora de Costa Rica, igual que lo evalúa la base de datos. */
export const STORE_TIME_ZONE = "America/Costa_Rica";

/** Orden de la semana para mostrar (lunes primero); el número es el de la base de datos (0 = domingo). */
export const weekdays = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
] as const;

export type HoursByDay = Record<number, { opens: string; closes: string }[]>;

export function groupHours(rows: { weekday: number | null; opens: string | null; closes: string | null }[]): HoursByDay {
  const result: HoursByDay = {};
  for (const row of rows) {
    if (row.weekday === null || !row.opens || !row.closes) continue;
    (result[row.weekday] ??= []).push({ opens: row.opens, closes: row.closes });
  }
  for (const ranges of Object.values(result)) ranges.sort((a, b) => a.opens.localeCompare(b.opens));
  return result;
}

export function flattenHours(byDay: HoursByDay) {
  return Object.entries(byDay).flatMap(([weekday, ranges]) => ranges.map((range) => ({ weekday: Number(weekday), ...range })));
}

const dateTime = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone: STORE_TIME_ZONE });
const dateOnly = new Intl.DateTimeFormat("es", { dateStyle: "full", timeZone: "UTC" });

export const formatStoreDateTime = (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : "—");
/** `on_date` llega como AAAA-MM-DD sin zona: se formatea como fecha de calendario. */
export const formatCalendarDate = (value: string) => dateOnly.format(new Date(`${value}T00:00:00Z`));

/** Hoy en Costa Rica (AAAA-MM-DD), para el mínimo de los selectores de fecha. */
export const todayInStoreZone = () => new Intl.DateTimeFormat("sv-SE", { timeZone: STORE_TIME_ZONE }).format(new Date());

/** El selector de fecha y hora local se interpreta como hora de Costa Rica (UTC−6, sin horario de verano). */
export const storeLocalToIso = (local: string) => new Date(`${local}:00-06:00`).toISOString();

export function storeState(store: { status: string | null; closed_until: string | null; open_now: boolean | null }) {
  if (store.status === "inactiva") return { label: "Inactiva", tone: "warning" as const };
  if (store.closed_until && new Date(store.closed_until) > new Date()) return { label: "Cerrada temporalmente", tone: "danger" as const };
  return store.open_now ? { label: "Abierta ahora", tone: "positive" as const } : { label: "Cerrada por horario", tone: "neutral" as const };
}
