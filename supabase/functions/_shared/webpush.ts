// Web Push sin dependencias externas: cifrado de mensajes (RFC 8291, aes128gcm) y autenticación del servidor (VAPID, RFC 8292).
// Solo usa WebCrypto, fetch y btoa: corre igual en Deno (Edge Functions) y en Node 20 o más.

export interface PushSubscriptionKeys {
  endpoint: string;
  /** Clave pública P-256 del navegador (65 bytes, base64url). */
  p256dh: string;
  /** Secreto de autenticación del navegador (16 bytes, base64url). */
  auth: string;
}

export interface VapidKeys {
  /** Clave pública P-256 sin comprimir (65 bytes, base64url). */
  publicKey: string;
  /** Clave privada (32 bytes, base64url). */
  privateKey: string;
  /** Contacto, por ejemplo mailto:soporte@rapitrip.com */
  subject: string;
}

const encoder = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** HKDF (extraer y expandir) con SHA-256. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, key, length * 8);
  return new Uint8Array(bits);
}

/**
 * Cifra `payload` para el navegador (RFC 8291). Devuelve el cuerpo completo del envío: encabezado (sal, tamaño de registro, clave
 * del servidor) más un único registro cifrado. `salt` y `ephemeral` solo se pasan en las pruebas.
 */
export async function encryptPayload(
  subscription: Pick<PushSubscriptionKeys, "p256dh" | "auth">,
  payload: Uint8Array,
  options: { salt?: Uint8Array; ephemeral?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  if (payload.length > 3993) throw new Error("el mensaje es demasiado largo para un registro (máximo 3993 bytes)");
  const uaPublic = b64urlDecode(subscription.p256dh);
  const authSecret = b64urlDecode(subscription.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("clave p256dh no válida");
  if (authSecret.length !== 16) throw new Error("secreto auth no válido");

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const ephemeral = options.ephemeral ?? (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, ephemeral.privateKey, 256));

  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  // Un solo registro: el mensaje seguido del delimitador 0x02 (último registro).
  const plaintext = concat(payload, new Uint8Array([2]));
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aes, plaintext as BufferSource));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/** Cabecera `Authorization` de VAPID (RFC 8292) para el servicio push de `endpoint`. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const publicBytes = b64urlDecode(vapid.publicKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) throw new Error("clave pública VAPID no válida");
  const privateBytes = b64urlDecode(vapid.privateKey);
  if (privateBytes.length !== 32) throw new Error("clave privada VAPID no válida");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: b64urlEncode(publicBytes.slice(1, 33)), y: b64urlEncode(publicBytes.slice(33, 65)), d: vapid.privateKey },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64urlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    encoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })),
  );
  const signingInput = `${header}.${claims}`;
  // WebCrypto devuelve la firma ECDSA en formato r||s de 64 bytes, que es lo que pide JWT (ES256).
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(signingInput) as BufferSource));
  return `vapid t=${signingInput}.${b64urlEncode(signature)}, k=${vapid.publicKey}`;
}

export interface SendResult {
  ok: boolean;
  status: number;
  /** El servicio push dice que el dispositivo ya no existe (404 o 410): hay que borrarlo. */
  gone: boolean;
  error?: string;
}

/**
 * Envía un mensaje a un dispositivo. `ttl` son los segundos que el servicio push puede guardarlo si el teléfono no está
 * disponible; `topic` hace que un mensaje nuevo reemplace a uno anterior con el mismo tema.
 */
export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  message: unknown,
  vapid: VapidKeys,
  options: { ttl: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string } = { ttl: 60 },
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const body = await encryptPayload(subscription, encoder.encode(JSON.stringify(message)));
  const headers: Record<string, string> = {
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(Math.max(0, Math.floor(options.ttl))),
    Urgency: options.urgency ?? "high",
    Authorization: await vapidAuthorization(subscription.endpoint, vapid),
  };
  if (options.topic) headers.Topic = options.topic;
  try {
    const res = await fetchImpl(subscription.endpoint, { method: "POST", headers, body: body as BodyInit });
    await res.body?.cancel();
    return { ok: res.status >= 200 && res.status < 300, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: String(e) };
  }
}
