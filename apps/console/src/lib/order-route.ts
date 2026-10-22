import type { LatLng } from "@rapitrip/maps";

/** Tienda y destino de un pedido tal como los usa la pantalla: cada punto es `null` si todavía no se marcó. */
export type RoutePoints = { storeName: string; store: LatLng | null; destination: LatLng | null };

export type RouteResult = { ok: true; points: RoutePoints } | { ok: false; error: string };
export type DistanceResult = { ok: true; km: number | null } | { ok: false; error: string };

type RouteRow = {
  store_name: string | null;
  store_latitude: number | null;
  store_longitude: number | null;
  dest_latitude: number | null;
  dest_longitude: number | null;
};

const point = (lat: number | null, lng: number | null): LatLng | null => (lat === null || lng === null ? null : { lat: Number(lat), lng: Number(lng) });

/** Convierte la fila de `order_route_points` en los puntos de la pantalla. */
export function toRoutePoints(row: RouteRow): RoutePoints {
  return { storeName: row.store_name ?? "", store: point(row.store_latitude, row.store_longitude), destination: point(row.dest_latitude, row.dest_longitude) };
}
