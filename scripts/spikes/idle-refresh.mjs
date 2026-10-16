import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const email = `idle-spike-${Date.now()}@t.test`;
const password = randomBytes(12).toString("base64url");
await admin.auth.admin.createUser({ email, password, email_confirm: true });

const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: true } });
let refreshes = 0;
client.auth.onAuthStateChange((event) => {
  if (event === "TOKEN_REFRESHED") {
    refreshes++;
    console.log(new Date().toISOString(), "TOKEN_REFRESHED sin que nadie toque nada");
  }
});
await client.auth.signInWithPassword({ email, password });
console.log("Sesión abierta. Sin actividad durante 330 segundos (el JWT dura 300)...");
await new Promise((resolve) => setTimeout(resolve, 330_000));
console.log(`Renovaciones automáticas sin actividad: ${refreshes}`);
await client.auth.signOut();
process.exit(0);