/**
 * Borrador de un formulario guardado en el navegador mientras el cliente vuelve a ingresar (la sesión del cliente dura 1 día).
 * Es una comodidad por pestaña: si el almacenamiento no está disponible, simplemente no se recupera nada.
 */
export function saveDraft(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Modo privado o almacenamiento bloqueado.
  }
}

/** Lee y borra el borrador: se usa una sola vez. */
export function takeDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
