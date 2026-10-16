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
const email = `login-spike-${Date.now()}@t.test`;
const password = randomBytes(12).toString("base64url");
await admin.auth.admin.createUser({ email, password, email_confirm: true });

const client = createClient(url, anon, { auth: { persistSession: false } });
console.log("Inicio correcto:", (await client.auth.signInWithPassword({ email, password })).error?.message ?? "ok");
for (let i = 1; i <= 3; i++) {
  const { error } = await client.auth.signInWithPassword({ email, password: `incorrecta-${i}` });
  console.log(`Intento fallido ${i}:`, error?.message);
}

console.log("\nAhora consulta el registro de Auth:\n");
console.log(`docker exec -i supabase_db_rapitrip psql -U postgres -c "select created_at, payload->>'action' as action, payload->>'actor_username' as who, payload->'traits' as traits, ip_address from auth.audit_log_entries where payload->>'actor_username' = '${email}' order by created_at;"`);