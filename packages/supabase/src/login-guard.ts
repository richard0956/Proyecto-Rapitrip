/** Estado del límite de intentos que devuelven `login_guard_check` y `login_guard_fail`. Los números salen de la base. */
export type LoginGuardState =
  | { locked: true; retry_after_seconds: number; lock_minutes: number }
  | { locked: false; remaining: number; warn: boolean; lock_minutes: number };

export const genericLoginError = "No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.";

function minutes(count: number): string {
  return count === 1 ? "1 minuto" : `${count} minutos`;
}

export function lockedLoginMessage(retryAfterSeconds: number): string {
  const left = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Por seguridad bloqueamos el acceso a esta cuenta tras varios intentos fallidos. Inténtalo de nuevo en ${minutes(left)}.`;
}

export function lastAttemptMessage(lockMinutes: number): string {
  return `No pudimos iniciar sesión. Te queda un último intento: si vuelves a fallar, el acceso a esta cuenta se bloqueará por ${minutes(lockMinutes)}.`;
}

/** Mensaje tras una contraseña incorrecta: el mismo para correos registrados y no registrados. */
export function failedLoginMessage(state: LoginGuardState): string {
  if (state.locked) return lockedLoginMessage(state.retry_after_seconds);
  return state.warn ? lastAttemptMessage(state.lock_minutes) : genericLoginError;
}
