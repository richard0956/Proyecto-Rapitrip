import { cajaNav, comercioNav, coordinacionNav, type NavSection } from "./nav";

/** Áreas de la consola que reportan incidentes de TI a la administración desde «Reportar incidente». */
export type ReportingArea = "caja" | "coordinacion" | "comercio";

export const reportingAreas: ReportingArea[] = ["caja", "coordinacion", "comercio"];

const navOf: Record<ReportingArea, NavSection[]> = { caja: cajaNav, coordinacion: coordinacionNav, comercio: comercioNav };

/** «¿Dónde pasó?»: las pantallas del menú de cada rol más las comunes, para que TI vaya directo al lugar. */
export function placesFor(area: ReportingArea): string[] {
  const screens = navOf[area].flatMap((section) => section.items).filter((item) => !item.soon && !item.href.endsWith("/incidentes")).map((item) => item.label);
  return [...screens, "Mi cuenta", "Inicio de sesión", "Otra pantalla"];
}

/** Cómo se nombra el origen de un incidente en la lista de la administración. */
export const sourceLabel: Record<string, string> = { caja: "Caja", coordinacion: "Coordinación", comercio: "Comercio", repartidor: "Repartidor" };
