// Repartidores de prueba con ubicación fija en Managua, para el Supabase local. Es idempotente.
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/dev/seed-couriers.mjs
// Cada cuenta nueva recibe una contraseña aleatoria que se imprime una sola vez. En producción cada repartidor entra por invitación.
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

const couriers = [
  { name: "Juan José", email: "juan.jose@demo.rapitrip.test", phone: "+50588810001", vehicle: "Moto", vehicleClass: "moto", lat: 12.1364, lng: -86.2514, place: "Metrocentro" },
  { name: "Caleb Miranda", email: "caleb.miranda@demo.rapitrip.test", phone: "+50588810002", vehicle: "Moto", vehicleClass: "moto", lat: 12.115, lng: -86.2362, place: "Altamira" },
  { name: "Pepe Aguilar", email: "pepe.aguilar@demo.rapitrip.test", phone: "+50588810003", vehicle: "Camioneta", vehicleClass: "vehiculo", lat: 12.1507, lng: -86.2683, place: "Centro histórico" },
  { name: "Diego López", email: "diego.lopez@demo.rapitrip.test", phone: "+50588810004", vehicle: "Camioneta", vehicleClass: "vehiculo", lat: 12.097, lng: -86.262, place: "Villa Fontana" },
];

const psql = (sql) => execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql }).toString().trim();
const q = (text) => `'${text.replaceAll("'", "''")}'`;

for (const c of couriers) {
  const { data: found } = await api.rpc("lookup_auth_user", { p_email: c.email });
  let id = found?.id;
  let password = null;
  if (!id) {
    password = `${randomBytes(9).toString("base64url")}-9a`;
    const { data, error } = await api.auth.admin.createUser({
      email: c.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: c.name },
      app_metadata: { rapitrip_app: "repartidor" },
    });
    if (error || !data.user) throw error ?? new Error(`No se pudo crear ${c.email}`);
    id = data.user.id;
  }
  // El servicio de autenticación guarda la marca de app después de insertar la cuenta: nace como «tienda» con rol de cliente.
  // Se pasa a repartidor y se revoca ese rol (solo se permite aquí, en local, con la marca de la transacción).
  psql(`begin;
    select set_config('rapitrip.allow_app_change', 'on', true);
    update identity.profiles set app = 'repartidor' where id = '${id}' and app <> 'repartidor';
    update identity.user_roles set status = 'revocado', status_reason = 'Cuenta de repartidor (Zero Trust)', status_changed_at = now()
      where user_id = '${id}' and role = 'cliente' and status <> 'revocado';
    commit;`);
  psql(`do $$ begin
    if not exists (select 1 from identity.couriers where user_id = '${id}') then
      insert into identity.couriers (full_name, phone, vehicle_type, vehicle_class, department, user_id)
      values (${q(c.name)}, '${c.phone}', ${q(c.vehicle)}, '${c.vehicleClass}', 'managua', '${id}');
    end if;
    update identity.couriers set latitude = ${c.lat}, longitude = ${c.lng}, location_updated_at = now(), available = true, available_since = coalesce(available_since, now())
      where user_id = '${id}';
    if not exists (select 1 from identity.user_roles where user_id = '${id}' and role = 'repartidor' and status <> 'revocado') then
      perform private.grant_role('${id}', 'repartidor', null, null);
    end if;
  end $$;`);
  console.log(`${c.name.padEnd(15)} ${c.email}  (${c.lat}, ${c.lng}) ${c.place}  ${password ? `contraseña: ${password}` : "(ya existía)"}`);
}
