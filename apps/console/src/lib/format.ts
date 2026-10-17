/** Zona fija para que servidor y navegador formateen igual. Configurable porque el proyecto no fija un país. */
const timeZone = process.env.NEXT_PUBLIC_TIMEZONE ?? "UTC";
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
