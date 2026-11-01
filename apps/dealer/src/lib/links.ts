import type { MapsApp } from "./prefs";

/**
 * Enlace para abrir la dirección en la app de mapas que eligió el repartidor en Preferencias (sin SDK ni costo). Prefiere el
 * punto exacto. Son enlaces universales: si la app no está instalada, se abren en el navegador.
 */
export function mapsUrl(place: { latitude?: number | null; longitude?: number | null; address?: string | null }, app: MapsApp = "google"): string | null {
  const point = place.latitude != null && place.longitude != null ? `${place.latitude},${place.longitude}` : null;
  const address = place.address?.trim();
  if (!point && !address) return null;
  const query = point ?? encodeURIComponent(address ?? "");
  if (app === "waze") return point ? `https://waze.com/ul?ll=${point}&navigate=yes` : `https://waze.com/ul?q=${query}&navigate=yes`;
  if (app === "apple") return `https://maps.apple.com/?daddr=${query}`;
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/** Enlace para llamar; deja solo dígitos y el signo +. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : null;
}
