import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { b64urlDecode, b64urlEncode, encryptPayload, sendWebPush, vapidAuthorization } from "./webpush.ts";

const enc = new TextEncoder();

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource }, key, length * 8));
}

/** El navegador: descifra lo que envía el servidor, siguiendo el RFC 8291 por su cuenta. */
async function browserDecrypt(body: Uint8Array, uaPrivate: CryptoKey, uaPublic: Uint8Array, authSecret: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16);
  assertEquals(new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), 4096);
  const idLength = body[20];
  const asPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  const asKey = await crypto.subtle.importKey("raw", asPublic as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaPrivate, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aes, ciphertext as BufferSource));
  assertEquals(plain[plain.length - 1], 2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function browser() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  return {
    pair, publicKey, authSecret,
    subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: b64urlEncode(publicKey), auth: b64urlEncode(authSecret) },
  };
}

async function vapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicKey = concat(new Uint8Array([4]), b64urlDecode(jwk.x!), b64urlDecode(jwk.y!));
  return { pair, keys: { publicKey: b64urlEncode(publicKey), privateKey: jwk.d!, subject: "mailto:soporte@rapitrip.test" } };
}

Deno.test("el navegador descifra exactamente el mensaje cifrado", async () => {
  const b = await browser();
  const message = JSON.stringify({ title: "Nueva propuesta de pedido", body: "Ñandú ✓" });
  const body = await encryptPayload(b.subscription, enc.encode(message));
  assertEquals(await browserDecrypt(body, b.pair.privateKey, b.publicKey, b.authSecret), message);
});

Deno.test("cada envío usa sal y clave efímera distintas", async () => {
  const b = await browser();
  const one = await encryptPayload(b.subscription, enc.encode("hola"));
  const two = await encryptPayload(b.subscription, enc.encode("hola"));
  assert(b64urlEncode(one) !== b64urlEncode(two));
});

Deno.test("rechaza claves inválidas y mensajes demasiado largos", async () => {
  const b = await browser();
  await assertRejects(() => encryptPayload({ p256dh: "xx", auth: b.subscription.auth }, enc.encode("a")));
  await assertRejects(() => encryptPayload(b.subscription, new Uint8Array(4000)));
});

Deno.test("la cabecera VAPID lleva una firma ES256 válida y vence en 12 horas", async () => {
  const v = await vapidKeys();
  const now = 1_800_000_000_000;
  const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", v.keys, now);
  const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
  assert(match);
  const [, h, c, s, k] = match;
  assertEquals(k, v.keys.publicKey);
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
  assertEquals(claims.aud, "https://fcm.googleapis.com");
  assertEquals(claims.sub, v.keys.subject);
  assertEquals(claims.exp, Math.floor(now / 1000) + 12 * 3600);
  assertEquals(JSON.parse(new TextDecoder().decode(b64urlDecode(h))).alg, "ES256");
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, v.pair.publicKey, b64urlDecode(s) as BufferSource, enc.encode(`${h}.${c}`) as BufferSource);
  assert(ok);
});

Deno.test("sendWebPush interpreta la respuesta del servicio push", async () => {
  const b = await browser();
  const v = await vapidKeys();
  const calls: { url: string; init: RequestInit }[] = [];
  const reply = (status: number): typeof fetch => ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(null, { status }));
  }) as unknown as typeof fetch;

  const ok = await sendWebPush(b.subscription, { kind: "oferta_nueva" }, v.keys, { ttl: 150, topic: "oferta" }, reply(201));
  assert(ok.ok && !ok.gone);
  const headers = calls[0].init.headers as Record<string, string>;
  assertEquals(headers["Content-Encoding"], "aes128gcm");
  assertEquals(headers.TTL, "150");
  assertEquals(headers.Urgency, "high");
  assertEquals(headers.Topic, "oferta");
  assert(headers.Authorization.startsWith("vapid t="));
  assertEquals(calls[0].url, b.subscription.endpoint);

  for (const status of [404, 410]) {
    const gone = await sendWebPush(b.subscription, {}, v.keys, { ttl: 10 }, reply(status));
    assert(!gone.ok && gone.gone);
  }
  const transient = await sendWebPush(b.subscription, {}, v.keys, { ttl: 10 }, reply(503));
  assert(!transient.ok && !transient.gone);
  const offline = await sendWebPush(b.subscription, {}, v.keys, { ttl: 10 }, (() => Promise.reject(new Error("red caída"))) as unknown as typeof fetch);
  assert(!offline.ok && !offline.gone && offline.status === 0);
});
