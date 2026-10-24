/** Córdobas, con dos decimales. */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `C$ ${n.toFixed(2)}` : "—";
}

/** Convierte lo que escribe el repartidor («350», «350,50», «C$ 350.5») en un número, o nulo si no es un monto válido. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/c\$|\s/gi, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}
