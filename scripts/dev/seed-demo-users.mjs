// Usuarios de prueba, uno por rol, para el Supabase local. Es idempotente: se puede correr las veces que haga falta.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/dev/seed-demo-users.mjs
// Los roles de consola (superadmin, admin, cajero, coordinador) piden activar el segundo factor en el primer ingreso.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (los imprime `pnpm db:start`).");
  process.exit(1);
}

const PASSWORD = "Rapitrip-Demo-2026";
const DB_CONTAINER = process.env.DB_CONTAINER ?? "supabase_db_rapitrip";
const api = createClient(url, key, { auth: { persistSession: false } });

const users = [
  { role: "superadmin", email: "director@demo.rapitrip.test", name: "Directora Demo" },
  { role: "admin", email: "admin@demo.rapitrip.test", name: "Administrador Demo" },
  { role: "cajero", email: "cajero@demo.rapitrip.test", name: "Cajero Demo" },
  { role: "coordinador", email: "coordinador@demo.rapitrip.test", name: "Coordinador Demo" },
  { role: "comercio", email: "comercio@demo.rapitrip.test", name: "Dueña de Comercio Demo" },
  { role: "cliente", email: "cliente@demo.rapitrip.test", name: "Cliente Demo" },
  { role: "repartidor", email: "repartidor@demo.rapitrip.test", name: "Repartidor Demo" },
];

const psql = (sql) =>
  execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql }).toString().trim();

async function ensureUser({ email, name }) {
  const { data: found } = await api.rpc("lookup_auth_user", { p_email: email });
  if (found?.id) {
    await api.auth.admin.updateUserById(found.id, { password: PASSWORD, email_confirm: true });
    return found.id;
  }
  const { data, error } = await api.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) throw error ?? new Error(`No se pudo crear ${email}`);
  return data.user.id;
}

for (const u of users) {
  const id = await ensureUser(u);
  switch (u.role) {
    case "cliente":
      break;
    case "superadmin": {
      const { error } = await api.rpc("bootstrap_superadmin", { p_user: id });
      if (error) throw error;
      break;
    }
    case "comercio":
      psql(`
        do $$ declare c uuid; begin
          if not exists (select 1 from identity.user_roles where user_id = '${id}' and role = 'comercio' and status <> 'revocado') then
            insert into identity.commerces (name, kind) values ('Comercio Demo', 'informal') returning id into c;
            perform private.grant_role('${id}', 'comercio', c, null);
          end if;
        end $$;`);
      break;
    case "repartidor":
      psql(`
        do $$ begin
          if not exists (select 1 from identity.couriers where user_id = '${id}') then
            insert into identity.couriers (full_name, phone, vehicle_type, vehicle_class, department, user_id)
            values ('Repartidor Demo', '+50588880000', 'Moto', 'moto', (select code from sales.departments order by code limit 1), '${id}');
          end if;
          if not exists (select 1 from identity.user_roles where user_id = '${id}' and role = 'repartidor' and status <> 'revocado') then
            perform private.grant_role('${id}', 'repartidor', null, null);
          end if;
        end $$;`);
      break;
    default:
      psql(`
        do $$ begin
          if not exists (select 1 from identity.user_roles where user_id = '${id}' and role = '${u.role}' and status <> 'revocado') then
            perform private.grant_role('${id}', '${u.role}', null, null);
          end if;
        end $$;`);
  }
  console.log(`${u.role.padEnd(12)} ${u.email}`);
}
console.log(`\nContraseña de todos: ${PASSWORD}`);
