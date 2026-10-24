/** Segundos que le quedan a una propuesta (nunca negativo). `now` se pasa en las pruebas. */
export function secondsLeft(expiresAt: string | null | undefined, now: number = Date.now()): number {
  if (!expiresAt) return 0;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

/** «2:05» para la cuenta regresiva. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** Motivos sugeridos para rechazar (todos cumplen el mínimo de 5 caracteres que exige la base de datos). */
export const rejectReasons = ["Estoy muy lejos", "Sin vehículo disponible", "Fuera de turno", "Otro motivo"] as const;
