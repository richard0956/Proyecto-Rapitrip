import { createHash, createHmac, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Los flujos con backend necesitan Supabase local (`pnpm db:start`) y estas tres variables. */
export const hasBackend = Boolean(url && anon && service);
export const backendHint = "Requiere Supabase local: define SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY (los imprime `pnpm db:start`).";

export const PASSWORD = "ClaveE2E-12345";

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function admin(): SupabaseClient {
  return createClient(url!, service!, options);
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}@e2e.test`;
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Código TOTP de 6 dígitos (RFC 6238) para el secreto que muestra la pantalla de alta del segundo factor. */
export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  const code = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(code % 10 ** 6).padStart(6, "0");
}

export async function createUser(email: string, { confirmed = true, fullName }: { confirmed?: boolean; fullName?: string } = {}) {
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: confirmed,
    user_metadata: fullName ? { full_name: fullName } : {},
  });
  if (error || !data.user) throw error ?? new Error("No se pudo crear el usuario");
  return data.user;
}

/** Confirma el correo de una cuenta creada desde la interfaz, sin depender del buzón de correo. */
export async function confirmEmail(email: string) {
  const client = admin();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) {
      const { error: updateError } = await client.auth.admin.updateUserById(user.id, { email_confirm: true });
      if (updateError) throw updateError;
      return;
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`No existe la cuenta ${email}`);
}

export async function createSuperadmin() {
  const email = uniqueEmail("director");
  const user = await createUser(email, { fullName: "Directora de Prueba" });
  const { error } = await admin().rpc("bootstrap_superadmin", { p_user: user.id });
  if (error) throw error;
  return { id: user.id, email, password: PASSWORD };
}

/** Sesión de consola completa (contraseña + TOTP + latido) para preparar datos por la API, sin pasar por la interfaz. */
export async function consoleClient(email: string, password = PASSWORD): Promise<SupabaseClient> {
  return (await consoleSession(email, password)).client;
}

/** Igual que `consoleClient`, pero devuelve también el secreto TOTP para poder iniciar sesión después por la interfaz. */
export async function consoleSession(email: string, password = PASSWORD): Promise<{ client: SupabaseClient; secret: string }> {
  const client = createClient(url!, anon!, options);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: enroll, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp" });
  if (enrollError || !enroll) throw enrollError ?? new Error("No se pudo enrolar el factor");
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: enroll.id });
  if (challengeError || !challenge) throw challengeError ?? new Error("No se pudo crear el desafío");
  const { error: verifyError } = await client.auth.mfa.verify({ factorId: enroll.id, challengeId: challenge.id, code: totp(enroll.totp.secret) });
  if (verifyError) throw verifyError;
  await client.rpc("touch_session");
  return { client, secret: enroll.totp.secret };
}

/** Crea una invitación con un token conocido (los correos de las Edge Functions solo se imprimen en el registro). */
export async function createInvitation(client: SupabaseClient, email: string, role: "admin" | "cajero" | "coordinador") {
  const token = randomBytes(32).toString("base64url");
  const { error } = await client.rpc("create_invitation", { p_email: email, p_role: role, p_token_hash: createHash("sha256").update(token).digest("hex") });
  if (error) throw error;
  return token;
}

/** Cuenta de comercio lista para usar: solicitud enviada por el cliente y aprobada por un director. */
/** `details` permite pedir una empresa: `{ business_kind: "empresa", ruc: "J0310000123456" }`; por omisión es un vendedor propio. */
export async function createCommerceAccount(businessName = "Comercio E2E", details: Record<string, string> = {}) {
  const email = uniqueEmail("comercio");
  await createUser(email, { fullName: "Dueña de Comercio" });
  const customer = createClient(url!, anon!, options);
  const { error: signInError } = await customer.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  const { data: request, error: requestError } = await customer.rpc("submit_commerce_request", { p_business_name: businessName, p_details: details });
  if (requestError || !request) throw requestError ?? new Error("No se pudo enviar la solicitud");

  const director = await createSuperadmin();
  const api = await consoleClient(director.email, director.password);
  const { error: approveError } = await api.rpc("approve_commerce_request", { p_request: request, p_convenio_confirmed: true });
  if (approveError) throw approveError;
  return { email, password: PASSWORD, businessName, director };
}
