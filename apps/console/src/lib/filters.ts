import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Valores de la URL: un valor inválido se descarta en vez de romper la pantalla. */
export const optionalText = (max = 80) => z.string().trim().min(1).max(max).optional().catch(undefined);
export const optionalDay = day.optional().catch(undefined);
export const optionalUuid = z.string().uuid().optional().catch(undefined);
export const optionalCursor = z.coerce.number().int().positive().optional().catch(undefined);

/** Primer instante del día (UTC), inclusivo. */
export function dayStart(date: string | undefined): string | undefined {
  return date ? `${date}T00:00:00.000Z` : undefined;
}

/** Primer instante del día siguiente (UTC): el filtro `hasta` lo trata como límite exclusivo. */
export function dayEndExclusive(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const next = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(next.getTime())) return undefined;
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export function queryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key, String(value));
  const text = query.toString();
  return text ? `?${text}` : "";
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Un día `AAAA-MM-DD` que existe en el calendario (el formato solo no basta: `2026-13-45` lo cumple). */
export function realDay(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : undefined;
}
