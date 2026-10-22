import type { LatLng } from "./geo";

/**
 * Único lugar del sistema que conoce a Mapbox. Las pantallas usan `PinPicker` y `MapView`; si algún día se cambia de proveedor,
 * se reemplaza este archivo y los dos componentes, no las pantallas.
 */
export const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

/** Mapbox GL se descarga solo cuando una pantalla con mapa lo pide (pesa bastante y el catálogo no lo necesita). */
export async function loadMapbox() {
  const module = await import("mapbox-gl");
  return module.default ?? module;
}

/** El token público (`pk.`) viaja al navegador; está restringido por dominio en la cuenta del proveedor. */
export function resolveToken(token?: string): string | null {
  const value = (token ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "").trim();
  return value.startsWith("pk.") ? value : null;
}

/** Mapbox GL necesita WebGL: sin él (o en pruebas) se muestra la alternativa sin mapa. */
export function webglSupported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

type ReverseResponse = { features?: { properties?: { full_address?: string; name?: string; place_formatted?: string } }[] };

/**
 * Dirección sugerida para un punto (geocoding inverso). Es solo una ayuda para rellenar el texto de la dirección: en Nicaragua
 * muchas direcciones no tienen calle ni número, así que puede devolver solo el barrio. `null` si no encuentra nada.
 */
export async function reverseGeocode(point: LatLng, token: string, signal?: AbortSignal): Promise<string | null> {
  const params = new URLSearchParams({ longitude: String(point.lng), latitude: String(point.lat), country: "ni", language: "es", limit: "1", access_token: token });
  try {
    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`, { signal });
    if (!response.ok) return null;
    const data = (await response.json()) as ReverseResponse;
    const props = data.features?.[0]?.properties;
    const text = props?.full_address ?? [props?.name, props?.place_formatted].filter(Boolean).join(", ");
    // El país sobra: todas las direcciones son de Nicaragua.
    const clean = text?.replace(/,\s*Nicaragua$/i, "").trim();
    return clean ? clean : null;
  } catch {
    return null;
  }
}

export type PlaceHit = { id: string; name: string; detail: string; point: LatLng };

type GeocodeResponse = {
  features?: { id?: string; properties?: { name?: string; place_formatted?: string }; geometry?: { coordinates?: [number, number] } }[];
};

/** Búsqueda de lugares en Nicaragua: solo ayuda para acercar el mapa; el punto que vale es el pin que la persona deja. */
export async function searchPlaces(query: string, token: string, near?: LatLng, signal?: AbortSignal): Promise<PlaceHit[]> {
  const text = query.trim();
  if (text.length < 3) return [];
  const params = new URLSearchParams({ q: text, country: "ni", language: "es", limit: "5", access_token: token });
  if (near) params.set("proximity", `${near.lng},${near.lat}`);
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, { signal });
  if (!response.ok) throw new Error("No se pudo buscar el lugar");
  const data = (await response.json()) as GeocodeResponse;
  return (data.features ?? []).flatMap((feature, index) => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates) return [];
    return [
      {
        id: feature.id ?? String(index),
        name: feature.properties?.name ?? text,
        detail: feature.properties?.place_formatted ?? "",
        point: { lat: coordinates[1], lng: coordinates[0] },
      },
    ];
  });
}
