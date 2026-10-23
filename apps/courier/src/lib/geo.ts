export type Position = { latitude: number; longitude: number };

/**
 * Ubicación puntual del instante de la evidencia (no hay seguimiento continuo). Devuelve nulo si el teléfono no la da, si el
 * repartidor no concede el permiso o si tarda demasiado: la ubicación solo sirve de alerta y nunca bloquea una entrega.
 */
export function currentPosition(timeoutMs = 7000): Promise<Position | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ latitude: Number(p.coords.latitude.toFixed(6)), longitude: Number(p.coords.longitude.toFixed(6)) });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
