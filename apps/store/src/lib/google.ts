/** El botón de Google solo se muestra cuando el proveedor está activado también en Supabase (ver docs/fase-1-puesta-en-marcha.md). */
export function googleEnabled() {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
}
