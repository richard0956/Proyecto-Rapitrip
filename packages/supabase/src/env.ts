export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  // Las cookies de localhost se comparten entre puertos: cada app fija su propio nombre para no pisar la sesión de la otra.
  const cookieName = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME || undefined;
  return { url, anonKey, cookieName };
}
