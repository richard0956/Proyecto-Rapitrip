/** Nombres de los departamentos (códigos de `sales.departments`). Un código desconocido se muestra legible en vez de en crudo. */
const names: Record<string, string> = {
  boaco: "Boaco",
  carazo: "Carazo",
  chinandega: "Chinandega",
  chontales: "Chontales",
  esteli: "Estelí",
  granada: "Granada",
  jinotega: "Jinotega",
  leon: "León",
  madriz: "Madriz",
  managua: "Managua",
  masaya: "Masaya",
  matagalpa: "Matagalpa",
  nueva_segovia: "Nueva Segovia",
  raccn: "Costa Caribe Norte",
  raccs: "Costa Caribe Sur",
  rio_san_juan: "Río San Juan",
  rivas: "Rivas",
};

export function departmentName(code: string | null | undefined): string {
  if (!code) return "";
  return names[code] ?? code.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
