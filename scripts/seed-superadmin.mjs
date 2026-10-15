import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!url || !key || !email) fail("faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SUPERADMIN_EMAIL");

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: found, error: lookupError } = await admin.rpc("lookup_auth_user", { p_email: email });
if (lookupError) fail(`no se pudo buscar la cuenta: ${lookupError.message}`);

let userId = found?.id;
let created = false;
if (!userId) {
  // Contraseña aleatoria que nadie conoce: la persona define la suya con el enlace de recuperación.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: { full_name: "Superadministrador" },
  });
  if (error || !data.user) fail(`no se pudo crear la cuenta: ${error?.message}`);
  userId = data.user.id;
  created = true;
}

const { error: roleError } = await admin.rpc("bootstrap_superadmin", { p_user: userId });
if (roleError) fail(`no se pudo asignar el rol: ${roleError.message}`);
await admin.rpc("audit_script_action", {
  p_action: "script.superadmin_seeded",
  p_target: userId,
  p_reason: "siembra del superadministrador por el equipo técnico",
});

console.log(`Rol superadmin asignado a ${email}${created ? " (cuenta nueva)" : " (cuenta existente)"}.`);

if (created) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) fail(`no se pudo generar el enlace: ${error.message}`);
  console.log("\nEnlace para definir tu contraseña (vence en 1 hora, no lo compartas):");
  console.log(link.properties.action_link);
}
console.log("\nAl entrar a la consola por primera vez deberás activar tu segundo factor.");
