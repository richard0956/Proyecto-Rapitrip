export type LatLng = { lat: number; lng: number };

/** Centro de Managua: punto de partida del mapa cuando todavía no hay un pin. */
export const MANAGUA: LatLng = { lat: 12.1364, lng: -86.2514 };

/**
 * Caja geográfica de Nicaragua con margen. Es solo un filtro contra pines mal puestos; la base de datos aplica la misma caja
 * (`private.valid_ni_point`), así que ambas deben cambiar juntas.
 */
const NICARAGUA = { minLat: 10.5, maxLat: 15.3, minLng: -88.0, maxLng: -82.2 };

export function isInNicaragua(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= NICARAGUA.minLat &&
    point.lat <= NICARAGUA.maxLat &&
    point.lng >= NICARAGUA.minLng &&
    point.lng <= NICARAGUA.maxLng
  );
}

/** Seis decimales (unos 11 cm): lo que guarda la base de datos. */
export function roundPoint(point: LatLng): LatLng {
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lat: round(point.lat), lng: round(point.lng) };
}

export function formatPoint(point: LatLng): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

export type Direction = "norte" | "sur" | "este" | "oeste";

const METERS_PER_DEGREE = 111_320;

/** Mueve el punto unos metros en una dirección: alternativa al arrastre del pin para quien usa teclado. */
export function nudge(point: LatLng, direction: Direction, meters = 10): LatLng {
  const dLat = meters / METERS_PER_DEGREE;
  const dLng = meters / (METERS_PER_DEGREE * Math.cos((point.lat * Math.PI) / 180));
  const next = {
    norte: { lat: point.lat + dLat, lng: point.lng },
    sur: { lat: point.lat - dLat, lng: point.lng },
    este: { lat: point.lat, lng: point.lng + dLng },
    oeste: { lat: point.lat, lng: point.lng - dLng },
  }[direction];
  return roundPoint(next);
}

/** Distancia en línea recta entre dos puntos, en kilómetros. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
