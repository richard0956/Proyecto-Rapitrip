"use client";

import { Button, Field } from "@rapitrip/ui";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LocateFixed, MapPin, Search, Trash2 } from "lucide-react";
import type { Marker } from "mapbox-gl";
import { useEffect, useId, useRef, useState } from "react";
import { formatPoint, isInNicaragua, MANAGUA, nudge, roundPoint, type Direction, type LatLng } from "./geo";
import { resolveToken, reverseGeocode, searchPlaces, type PlaceHit } from "./mapbox";
import { useMap } from "./use-map";

export type PinPickerProps = {
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  /** Texto de la etiqueta del grupo. */
  label?: string;
  hint?: string;
  disabled?: boolean;
  /** Token público de Mapbox; por defecto `NEXT_PUBLIC_MAPBOX_TOKEN`. */
  token?: string;
  /** Muestra la caja de búsqueda de lugares (solo ayuda para acercar el mapa). */
  searchable?: boolean;
  /** Si se da, al marcar un punto se sugiere su dirección escrita y esta función recibe el texto cuando la persona la acepta. */
  onUseAddress?: (address: string) => void;
};

const moves: { direction: Direction; Icon: typeof ArrowUp; text: string }[] = [
  { direction: "norte", Icon: ArrowUp, text: "norte" },
  { direction: "sur", Icon: ArrowDown, text: "sur" },
  { direction: "oeste", Icon: ArrowLeft, text: "oeste" },
  { direction: "este", Icon: ArrowRight, text: "este" },
];

/**
 * Selector de ubicación: el pin es la fuente de verdad (la dirección escrita es solo apoyo).
 * Se marca tocando el mapa, arrastrando el pin, con «Usar mi ubicación» o buscando un lugar; los botones de dirección son la
 * alternativa para quien no usa ratón. Sin mapa (sin token o sin WebGL) conserva «Usar mi ubicación» y el resto de la pantalla sigue
 * funcionando.
 */
export function PinPicker({ value, onChange, label = "Ubicación en el mapa", hint, disabled, token, searchable = true, onUseAddress }: PinPickerProps) {
  const labelId = useId();
  const container = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Marker | null>(null);
  const { status, mapRef, mapboxRef } = useMap(container, { token, center: value ?? MANAGUA, zoom: value ? 16 : 12 });
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const accessToken = resolveToken(token);
  // Dirección sugerida (geocoding inverso) para el punto actual; se guarda con su punto para no mostrar la de un pin anterior.
  const [suggestion, setSuggestion] = useState<{ key: string; text: string } | null>(null);
  const pointKey = value ? `${value.lat},${value.lng}` : null;

  // Las funciones de los eventos del mapa se crean una vez: siempre deben ver el `onChange` y el estado más recientes.
  const commit = useRef<(point: LatLng) => void>(() => {});
  useEffect(() => {
    commit.current = (point: LatLng) => {
      if (disabled) return;
      if (!isInNicaragua(point)) {
        setNotice("Ese punto está fuera de Nicaragua. Marca un lugar dentro del país.");
        return;
      }
      setNotice(null);
      onChange(roundPoint(point));
    };
  });

  // Tocar el mapa coloca el pin.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    const onClick = (event: { lngLat: { lat: number; lng: number } }) => commit.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    map.on("click", onClick);
    return () => {
      try {
        map.off("click", onClick);
      } catch {
        // El mapa ya se destruyó al desmontar.
      }
    };
  }, [status, mapRef]);

  // El marcador sigue al valor, venga de donde venga (toque, arrastre, botones, ubicación o búsqueda).
  useEffect(() => {
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (status !== "ready" || !map || !mapbox) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const marker = new mapbox.Marker({ color: "#0b7a57", draggable: !disabled }).setLngLat([value.lng, value.lat]).addTo(map);
      marker.on("dragend", () => {
        const point = marker.getLngLat();
        commit.current({ lat: point.lat, lng: point.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
      markerRef.current.setDraggable(!disabled);
    }
    if (!map.getBounds()?.contains([value.lng, value.lat]) || map.getZoom() < 14) {
      map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 16), duration: 400 });
    }
  }, [value, status, disabled, mapRef, mapboxRef]);

  useEffect(
    () => () => {
      markerRef.current?.remove();
      markerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!onUseAddress || !accessToken || !value || !pointKey) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const text = await reverseGeocode(value, accessToken, controller.signal);
      if (!controller.signal.aborted && text) setSuggestion({ key: pointKey, text });
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `pointKey` identifica el punto: mover el pin pide otra sugerencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey, accessToken, !!onUseAddress]);

  function locate() {
    if (!navigator.geolocation) {
      setNotice("Tu dispositivo no permite obtener la ubicación. Márcala en el mapa.");
      return;
    }
    setNotice(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        commit.current({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (error) => {
        setLocating(false);
        setNotice(error.code === 1 ? "No diste permiso para usar tu ubicación. Márcala en el mapa." : "No pudimos obtener tu ubicación. Márcala en el mapa.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  async function search() {
    if (!accessToken) return;
    setNotice(null);
    setSearching(true);
    try {
      const found = await searchPlaces(query, accessToken, value ?? MANAGUA);
      setHits(found);
      if (found.length === 0) setNotice("No encontramos ese lugar. Márcalo directamente en el mapa.");
    } catch {
      setHits([]);
      setNotice("No pudimos buscar en este momento. Márcalo directamente en el mapa.");
    } finally {
      setSearching(false);
    }
  }

  const mapVisible = status !== "unavailable";
  const canSearch = searchable && mapVisible && !!accessToken;

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3" data-slot="pin-picker">
      <div>
        <p id={labelId} className="text-xs font-bold text-tinta-suave">
          {label}
        </p>
        {hint ? <p className="text-xs text-tinta-suave">{hint}</p> : null}
      </div>

      {canSearch ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field
                label="Buscar un lugar (opcional)"
                icon={<Search className="size-4" />}
                value={query}
                disabled={disabled}
                placeholder="Barrio, comercio o punto conocido"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
              />
            </div>
            <Button variant="secondary" disabled={disabled || searching || query.trim().length < 3} onClick={() => void search()}>
              {searching ? "Buscando…" : "Buscar"}
            </Button>
          </div>
          {hits.length > 0 ? (
            <ul aria-label="Resultados de la búsqueda" className="flex flex-col gap-1.5">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-start gap-2 rounded-2xl border border-borde-campo bg-white px-3.5 py-2 text-left text-[13px] hover:bg-menta/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
                    onClick={() => {
                      commit.current(hit.point);
                      setHits([]);
                    }}
                  >
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-hoja" />
                    <span className="min-w-0">
                      <span className="block font-bold text-tinta">{hit.name}</span>
                      {hit.detail ? <span className="block text-tinta-suave">{hit.detail}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mapVisible ? (
        <div className="relative">
          <div ref={container} role="region" aria-label="Mapa para marcar el punto exacto" className="h-64 w-full overflow-hidden rounded-2xl border border-borde-campo bg-menta/40 sm:h-80" />
          {status === "loading" ? (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-tinta-suave" aria-live="polite">
              Cargando el mapa…
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-borde-campo bg-menta/40 px-4 py-3 text-[13px] text-tinta-suave">
          El mapa no está disponible en este momento. Puedes continuar con la dirección escrita
          {typeof navigator !== "undefined" && "geolocation" in navigator ? " o usar tu ubicación actual." : "."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" disabled={disabled || locating} onClick={locate}>
          <LocateFixed aria-hidden="true" className="size-4" />
          {locating ? "Buscando tu ubicación…" : "Usar mi ubicación"}
        </Button>
        {value ? (
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              setNotice(null);
              onChange(null);
            }}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Quitar el pin
          </Button>
        ) : null}
      </div>

      {value && status === "ready" && !disabled ? (
        <div role="group" aria-label="Ajustar el pin con botones" className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-tinta-suave">Mover 10 m:</span>
          {moves.map(({ direction, Icon, text }) => (
            <button
              key={direction}
              type="button"
              aria-label={`Mover el pin 10 metros al ${text}`}
              className="inline-flex size-11 items-center justify-center rounded-full bg-papel text-hoja shadow-[inset_0_0_0_1.5px_var(--hoja)] hover:bg-menta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
              onClick={() => commit.current(nudge(value, direction))}
            >
              <Icon aria-hidden="true" className="size-4" />
            </button>
          ))}
        </div>
      ) : null}

      {onUseAddress && suggestion && suggestion.key === pointKey ? (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-menta/40 px-4 py-3 text-[13px]">
          <p className="text-tinta-suave">Dirección sugerida para este punto:</p>
          <p className="font-bold text-tinta">{suggestion.text}</p>
          <Button variant="ghost" disabled={disabled} className="self-start" onClick={() => onUseAddress(suggestion.text)}>
            Usar como dirección
          </Button>
        </div>
      ) : null}

      <p className="text-[13px] text-tinta-suave" aria-live="polite">
        {value ? `Punto marcado: ${formatPoint(value)}.` : mapVisible ? "Todavía no marcas el punto. Toca el mapa para dejar el pin." : "Todavía no marcas el punto."}
      </p>
      {notice ? (
        <p role="alert" className="text-[13px] font-bold text-rojo">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
