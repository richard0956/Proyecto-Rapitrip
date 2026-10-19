const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
/** Se muestra de lunes a domingo. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export type HoursRow = { day: string; text: string };

/** Agrupa los tramos por día: «Lunes · 08:00–12:00, 14:00–18:00». Los días sin tramos figuran como «Cerrado». */
export function hoursRows(hours: { weekday: number; opens: string; closes: string }[]): HoursRow[] {
  return ORDER.map((weekday) => {
    const ranges = hours.filter((h) => h.weekday === weekday).sort((a, b) => a.opens.localeCompare(b.opens));
    return { day: DAYS[weekday]!, text: ranges.length ? ranges.map((r) => `${r.opens}–${r.closes}`).join(", ") : "Cerrado" };
  });
}
