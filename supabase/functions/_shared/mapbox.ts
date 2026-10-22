export type Point = { lat: number; lng: number };

/**
 * Distancia por calle (conduciendo) entre dos puntos, en kilómetros, con la API de rutas de Mapbox.
 * Devuelve `null` si no hay token, el servicio no responde a tiempo o no encuentra camino: quien la llama debe tener un respaldo
 * (aquí, la línea recta por el factor de ruta que aplica la base de datos).
 */
export async function roadDistanceKm(
  from: Point,
  to: Point,
  token: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<number | null> {
  if (!token) return null;
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const params = new URLSearchParams({ overview: "false", access_token: token });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`https://api.mapbox.com/directions/v5/mapbox/driving/${path}?${params}`, { signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { routes?: { distance?: number }[] };
    const meters = data.routes?.[0]?.distance;
    return typeof meters === "number" && meters > 0 ? meters / 1000 : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const isCoordinate = (value: unknown, limit: number): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
