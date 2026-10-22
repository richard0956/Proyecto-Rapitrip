import type { LatLng } from "./geo";

export type RouteResult = {
  /** Distancia por calle, en kilómetros. */
  distanceKm: number;
  /** Tiempo de manejo estimado, en minutos (sin tráfico en vivo). */
  minutes: number;
  /** Trazo de la ruta como pares [longitud, latitud]. */
  coordinates: [number, number][];
};

type DirectionsResponse = { routes?: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }[] };

/**
 * Ruta de manejo entre dos puntos. Devuelve `null` si el servicio no responde o no encuentra camino: quien la llama debe poder
 * seguir mostrando la distancia en línea recta.
 */
export async function fetchRoute(from: LatLng, to: LatLng, token: string, signal?: AbortSignal): Promise<RouteResult | null> {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const params = new URLSearchParams({ geometries: "geojson", overview: "full", access_token: token });
  try {
    const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${path}?${params}`, { signal });
    if (!response.ok) return null;
    const data = (await response.json()) as DirectionsResponse;
    const route = data.routes?.[0];
    if (!route) return null;
    return { distanceKm: route.distance / 1000, minutes: route.duration / 60, coordinates: route.geometry?.coordinates ?? [] };
  } catch {
    return null;
  }
}

/** «1,3 km» o «850 m». */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

/** «14 min» o «1 h 5 min». */
export function formatMinutes(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
