// Genera el par de claves VAPID para los avisos push. Uso: node scripts/generate-vapid-keys.mjs
// La clave pública va en la aplicación del repartidor (NEXT_PUBLIC_VAPID_PUBLIC_KEY) y en las funciones de borde
// (VAPID_PUBLIC_KEY). La privada es un SECRETO: solo va en las funciones de borde (VAPID_PRIVATE_KEY). No se vuelve a mostrar.
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");

console.log("Copia estas líneas donde corresponda (la privada, solo en las funciones de borde):\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("VAPID_SUBJECT=mailto:soporte@tu-dominio.com");
