// Genera un token de invitación y su hash SHA-256, para probar accept-invitation en local.
// Uso: deno run scripts/dev/new-invite-token.ts
import { generateToken, sha256Hex } from "../../supabase/functions/_shared/token.ts";

const token = generateToken();
console.log(JSON.stringify({ token, hash: await sha256Hex(token) }));
