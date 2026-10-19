/** Número de página (≥ 1) desde la URL; cualquier cosa rara vale 1. */
export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}

/** Texto de búsqueda acotado a lo que acepta el servidor (80 caracteres). */
export function parseQuery(value: string | string[] | undefined): string | null {
  const text = (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 80);
  return text ? text : null;
}

export function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== "" && value !== 1) search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : "";
}
