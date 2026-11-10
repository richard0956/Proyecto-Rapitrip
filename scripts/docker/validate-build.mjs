const app = process.env.APP_NAME;
if (!["store", "console", "dealer"].includes(app)) {
  throw new Error("APP_NAME debe ser store, console o dealer.");
}
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
  const url = new URL(process.env[name] || "");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`${name} debe usar HTTP o HTTPS.`);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Usa la clave pública, nunca service_role.");
}
console.log(`Configuración pública de ${app} validada.`);
