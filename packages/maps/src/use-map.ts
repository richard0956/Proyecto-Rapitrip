"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect, useRef, useState, type RefObject } from "react";
import { MANAGUA, type LatLng } from "./geo";
import { loadMapbox, MAP_STYLE, resolveToken, webglSupported } from "./mapbox";

export type MapStatus = "loading" | "ready" | "unavailable";
type Mapbox = Awaited<ReturnType<typeof loadMapbox>>;

/**
 * Crea el mapa dentro del contenedor, una sola vez, y lo destruye al desmontar.
 * `unavailable` (sin token, sin WebGL o con el servicio caído) es un estado normal: las pantallas siguen funcionando con la
 * dirección escrita.
 */
export function useMap(container: RefObject<HTMLDivElement | null>, options: { token?: string; center?: LatLng; zoom?: number } = {}) {
  const { token, center = MANAGUA, zoom = 12 } = options;
  const [status, setStatus] = useState<MapStatus>("loading");
  const mapRef = useRef<MapboxMap | null>(null);
  const mapboxRef = useRef<Mapbox | null>(null);

  useEffect(() => {
    const accessToken = resolveToken(token);
    if (!accessToken || !webglSupported()) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    let map: MapboxMap | null = null;
    loadMapbox()
      .then((mapbox) => {
        if (cancelled || !container.current) return;
        mapbox.accessToken = accessToken;
        mapboxRef.current = mapbox;
        let loaded = false;
        map = new mapbox.Map({ container: container.current, style: MAP_STYLE, center: [center.lng, center.lat], zoom, attributionControl: true });
        map.addControl(new mapbox.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          loaded = true;
          if (!cancelled) setStatus("ready");
        });
        // Un token inválido o bloqueado falla antes de cargar el estilo; los errores de una tienda de teselas ya con el mapa listo no.
        map.on("error", () => {
          if (!loaded && !cancelled) setStatus("unavailable");
        });
        mapRef.current = map;
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // El centro y el zoom son solo el punto de partida: moverlos después no recrea el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { status, mapRef, mapboxRef };
}
