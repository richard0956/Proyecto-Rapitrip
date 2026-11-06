// Equipo real de Rapitrip en la consola, para el Supabase local. Es idempotente: si la cuenta existe solo se asegura el rol.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/dev/seed-team.mjs
// Cada cuenta nueva recibe una contraseña aleatoria que se imprime una sola vez (no se guarda en el repositorio).
// En producción NO se corre: allí cada persona entra con la invitación (Admin → Usuarios → Invitar), con el mismo correo y rol de esta lista.
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (los imprime `pnpm db:start`).");
  process.exit(1);
}

const DB_CONTAINER = process.env.DB_CONTAINER ?? "supabase_db_rapitrip";
const api = createClient(url, key, { auth: { persistSession: false } });

export const team = [
  { role: "superadmin", email: "richard.malespin@demo.rapitrip.test", name: "Richard Malespin" },
  { role: "admin", email: "yamil.kuant@demo.rapitrip.test", name: "Yamil Kuant" },
  { role: "coordinador", email: "irving.lopez@demo.rapitrip.test", name: "Irving López" },
  { role: "cajero", email: "marlyng.miranda@demo.rapitrip.test", name: "Marlyng Miranda" },
  { role: "cajero", email: "moises.zelaya@demo.rapitrip.test", name: "Moisés Zelaya" },
];

const psql = (sql) => execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql }).toString().trim();

for (const u of team) {
  const { data: found } = await api.rpc("lookup_auth_user", { p_email: u.email });
  let id = found?.id;
  let password = null;
  if (!id) {
    password = `${randomBytes(9).toString("base64url")}-9a`;
    const { data, error } = await api.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: u.name },
      app_metadata: { rapitrip_app: "consola" },
    });
    if (error || !data.user) throw error ?? new Error(`No se pudo crear ${u.email}`);
    id = data.user.id;
  }
  // El servicio de autenticación guarda la marca de app después de insertar la cuenta, así que nace como «tienda» con rol de cliente.
  // Se pasa a consola y se revoca ese rol (solo se permite aquí, en local, con la marca de la transacción).
  psql(`begin;
    select set_config('rapitrip.allow_app_change', 'on', true);
    update identity.profiles set app = 'consola' where id = '${id}' and app <> 'consola';
    update identity.user_roles set status = 'revocado', status_reason = 'Cuenta de consola (Zero Trust)', status_changed_at = now()
      where user_id = '${id}' and role = 'cliente' and status <> 'revocado';
    commit;`);
  if (u.role === "superadmin") {
    const { error } = await api.rpc("bootstrap_superadmin", { p_user: id });
    if (error) throw error;
  } else {
    psql(`do $$ begin
      if not exists (select 1 from identity.user_roles where user_id = '${id}' and role = '${u.role}' and status <> 'revocado') then
        perform private.grant_role('${id}', '${u.role}', null, null);
      end if;
    end $$;`);
  }
  console.log(`${u.role.padEnd(12)} ${u.name.padEnd(18)} ${u.email}  ${password ? `contraseña: ${password}` : "(ya existía)"}`);
}
console.log("\nAl entrar a la consola por primera vez cada persona deberá activar su segundo factor.");
