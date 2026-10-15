import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const reason = process.env.RESET_REASON?.trim();

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!url || !key || !email) fail("faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o SUPERADMIN_EMAIL");
if (!reason || reason.length < 10) fail("define RESET_REASON con el motivo (mínimo 10 caracteres)");

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: found, error: lookupError } = await admin.rpc("lookup_auth_user", { p_email: email });
if (lookupError) fail(lookupError.message);
if (!found) fail("no existe una cuenta con ese correo");

const { data, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: found.id });
if (listError) fail(listError.message);

for (const factor of data?.factors ?? []) {
  const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: found.id });
  if (error) fail(`no se pudo borrar el factor ${factor.id}: ${error.message}`);
}

await admin.rpc("audit_script_action", { p_action: "script.mfa_reset", p_target: found.id, p_reason: reason });
console.log(`Factores borrados: ${data?.factors?.length ?? 0}. En el próximo inicio de sesión deberá activar uno nuevo.`);
console.log("Las sesiones abiertas caducan solas en unos minutos (JWT de 5 minutos).");