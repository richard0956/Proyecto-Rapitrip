import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) {
  console.error("Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret, step = 30, digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / step)));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

const decode = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());

const admin = createClient(url, service, { auth: { persistSession: false } });
const email = `spike-${Date.now()}@t.test`;
const password = randomBytes(12).toString("base64url");

const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createError) throw createError;
const { error: bootError } = await admin.rpc("bootstrap_superadmin", { p_user: created.user.id });
if (bootError) throw bootError;

const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError) throw signInError;

let claims = decode(signIn.session.access_token);
console.log("1) Tras la contraseña:", JSON.stringify({ aal: claims.aal, amr: claims.amr, app_roles: claims.app_roles }));

await client.rpc("touch_session");
const incident = { p_type: "seguridad", p_severity: "baja", p_description: "Prueba de sesión de consola" };
let r = await client.rpc("report_incident", incident);
console.log("2) report_incident con aal1 (debe fallar con 42501):", r.error?.code ?? "SIN ERROR (mal)");

const { data: enroll, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp" });
if (enrollError) throw enrollError;
const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: enroll.id });
if (challengeError) throw challengeError;
const { error: verifyError } = await client.auth.mfa.verify({
  factorId: enroll.id, challengeId: challenge.id, code: totp(enroll.totp.secret),
});
if (verifyError) throw verifyError;

const { data: current } = await client.auth.getSession();
claims = decode(current.session.access_token);
console.log("3) Tras el TOTP:", JSON.stringify({ aal: claims.aal, amr: claims.amr }));

await client.rpc("touch_session");
r = await client.rpc("report_incident", incident);
console.log("4) report_incident con aal2 + contraseña + actividad (debe funcionar):",
  r.error ? `ERROR ${r.error.code}: ${r.error.message}` : `OK ${r.data}`);

if (process.env.RUN_FUNCTIONS === "1") {
  const call = async (name, body) => {
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${current.session.access_token}`, apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return `${res.status} ${await res.text()}`;
  };
  console.log("5) invite-staff:", await call("invite-staff", { email: "invitado@t.test", role: "admin" }));
  console.log("6) export-data:", await call("export-data", { dataset: "accounts", reason: "prueba de exportación local" }));
}