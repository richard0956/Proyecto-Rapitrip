/** Zona fija para que servidor y navegador formateen igual. Por defecto, Managua (el prototipo usa córdobas); configurable con NEXT_PUBLIC_TIMEZONE. */
const timeZone = process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua";
const dateTime = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone });
const date = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeZone });

export const formatDateTime = (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : "—");
export const formatDate = (value: string | null | undefined) => (value ? date.format(new Date(value)) : "—");

export const roleLabel: Record<string, string> = {
  superadmin: "Director",
  admin: "Administrador",
  cajero: "Encargado de ventas (caja)",
  coordinador: "Encargado de ventas (coordinación)",
  comercio: "Comercio",
  cliente: "Cliente",
};

const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** «hace 2 días», «hace 5 h». Se calcula en el servidor para que no cambie al hidratar. */
export function timeAgo(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "—";
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return "hace un momento";
}
