function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Token de invitación: 32 bytes aleatorios en base64url (43 caracteres). */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const PASSPHRASE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Frase de paso de 20 caracteres, sin 0/O/1/l/I. Muestreo con rechazo para no sesgar. */
export function generatePassphrase(): string {
  const limit = 256 - (256 % PASSPHRASE_ALPHABET.length);
  let out = "";
  while (out.length < 20) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit && out.length < 20) out += PASSPHRASE_ALPHABET[b % PASSPHRASE_ALPHABET.length];
    }
  }
  return out;
}