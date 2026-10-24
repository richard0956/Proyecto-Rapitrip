/** Enlace para abrir la dirección en la aplicación de mapas del teléfono (sin SDK ni costo). Prefiere el punto exacto. */
export function mapsUrl(place: { latitude?: number | null; longitude?: number | null; address?: string | null }): string | null {
  if (place.latitude != null && place.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  const address = place.address?.trim();
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

/** Enlace para llamar; deja solo dígitos y el signo +. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : null;
}
