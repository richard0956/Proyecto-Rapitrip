"use client";

import { useEffect, useRef } from "react";
import { formatPoint, MANAGUA, type LatLng } from "./geo";
import { useMap } from "./use-map";

export type MapMarker = { id: string; point: LatLng; label: string; tone?: "tienda" | "cliente" };

const colors = { tienda: "#0c4e67", cliente: "#0b7a57" } as const;
const ROUTE_ID = "ruta-entrega";

/**
 * Mapa de solo lectura con uno o varios puntos (por ejemplo, tienda y destino) y, opcionalmente, el trazo de una ruta.
 * Sin mapa disponible muestra la lista de puntos.
 */
export function MapView({ markers, route, token, ariaLabel = "Mapa" }: { markers: MapMarker[]; route?: [number, number][] | null; token?: string; ariaLabel?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const first = markers[0]?.point ?? MANAGUA;
  const { status, mapRef, mapboxRef } = useMap(container, { token, center: first, zoom: 14 });
  const key = markers.map((m) => `${m.id}:${m.point.lat},${m.point.lng}`).join("|");
  const routeKey = route ? `${route.length}:${route[0]?.join(",")}:${route[route.length - 1]?.join(",")}` : "";

  useEffect(() => {
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (status !== "ready" || !map || !mapbox || markers.length === 0) return;
    const placed = markers.map((m) => new mapbox.Marker({ color: colors[m.tone ?? "cliente"] }).setLngLat([m.point.lng, m.point.lat]).addTo(map));

    const line = route && route.length > 1 ? route : null;
    if (line) {
      map.addSource(ROUTE_ID, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } } });
      map.addLayer({
        id: ROUTE_ID,
        type: "line",
        source: ROUTE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0b7a57", "line-width": 5, "line-opacity": 0.85 },
      });
    }

    if (markers.length === 1 && !line) {
      map.easeTo({ center: [markers[0]!.point.lng, markers[0]!.point.lat], zoom: 15, duration: 0 });
    } else {
      const start: [number, number] = [markers[0]!.point.lng, markers[0]!.point.lat];
      const bounds = new mapbox.LngLatBounds(start, start);
      markers.forEach((m) => bounds.extend([m.point.lng, m.point.lat]));
      line?.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 0 });
    }
    return () => {
      placed.forEach((marker) => marker.remove());
      // Al desmontar, `useMap` ya destruyó el mapa (su limpieza corre primero): tocar sus capas lanzaría un error.
      try {
        if (map.getLayer(ROUTE_ID)) map.removeLayer(ROUTE_ID);
        if (map.getSource(ROUTE_ID)) map.removeSource(ROUTE_ID);
      } catch {
        // El mapa ya no existe: no queda nada que quitar.
      }
    };
    // `key` y `routeKey` resumen el contenido de los puntos y del trazo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, routeKey, status, mapRef, mapboxRef]);

  return (
    <div className="flex flex-col gap-2">
      {status !== "unavailable" ? (
        <div ref={container} role="region" aria-label={ariaLabel} className="h-56 w-full overflow-hidden rounded-2xl border border-borde-campo bg-menta/40 sm:h-72" />
      ) : null}
      <ul className="flex flex-col gap-1 text-[13px] text-tinta-suave">
        {markers.map((m) => (
          <li key={m.id}>
            <span className="font-bold text-tinta">{m.label}:</span> {formatPoint(m.point)}
          </li>
        ))}
      </ul>
    </div>
  );
}
