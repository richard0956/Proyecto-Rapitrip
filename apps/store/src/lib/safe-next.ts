/** Destino tras ingresar: solo rutas internas. Evita que `?next=` mande al cliente a un sitio externo. */
export function safeNext(value: string | string[] | null | undefined, fallback = "/"): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
