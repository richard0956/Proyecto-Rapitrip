import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service } = process.env;
if (!url || !anon || !service) {
  console.error("Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const email = `sesion-${Date.now()}@t.test`;
const password = "clave-larga-1";
await admin.auth.admin.createUser({ email, password, email_confirm: true });

const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: s } = await c.auth.signInWithPassword({ email, password });
const claims = JSON.parse(Buffer.from(s.session.access_token.split(".")[1], "base64url").toString());

const psql = (sql) =>
  execSync(`docker exec -i supabase_db_rapitrip psql -U postgres -t -A -c "${sql}"`).toString().trim();
const show = (label, r) =>
  console.log(label, r.error ? `ERROR ${r.error.code ?? ""} ${r.error.message}` : r.data?.length !== undefined ? `${r.data.length} fila(s)` : "OK");

console.log("¿el session_id del token existe en auth.sessions?",
  psql(`select count(*) from auth.sessions where id='${claims.session_id}'`) === "1" ? "sí" : "NO");
show("1) my_profile, sesión nueva:        ", await c.from("my_profile").select("id"));
show("2) update_my_profile, sesión nueva: ", await c.rpc("update_my_profile", { p_full_name: "Cliente Real", p_phone: "88881234" }));

// Envejecer la sesión real desde el servidor (simula 25 horas)
psql(`update auth.sessions set created_at = now() - interval '25 hours' where id='${claims.session_id}'`);
show("3) my_profile, sesión de 25 horas:  ", await c.from("my_profile").select("id"));
show("4) update_my_profile, 25 horas:     ", await c.rpc("update_my_profile", { p_full_name: "Otro Nombre", p_phone: "88881234" }));

const c2 = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
await c2.auth.signInWithPassword({ email, password });
show("5) my_profile tras iniciar sesión de nuevo:", await c2.from("my_profile").select("id"));