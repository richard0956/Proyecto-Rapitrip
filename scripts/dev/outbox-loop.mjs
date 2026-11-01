// Dispara la función `send-outbox` cada minuto para que salgan los correos encolados (avisos de pedido, invitaciones…).
// Es el reemplazo local de un cron: en producción debe haber algo equivalente que llame a la función cada minuto con `x-outbox-secret`.
//   pnpm outbox:loop            (necesita `supabase functions serve --env-file supabase/functions/.env` corriendo)
import { readFileSync } from "node:fs";

function readEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
    );
  } catch {
    return {};
  }
}

const functionsEnv = readEnv("supabase/functions/.env");
const storeEnv = readEnv("apps/store/.env.local");
const base = process.env.SUPABASE_URL ?? storeEnv.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anon = process.env.SUPABASE_ANON_KEY ?? storeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? storeEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secret = process.env.OUTBOX_SECRET ?? functionsEnv.OUTBOX_SECRET;
const everyMs = Number(process.env.OUTBOX_EVERY_MS ?? 60_000);

if (!secret) {
  console.error("Falta OUTBOX_SECRET en supabase/functions/.env.");
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(`${base}/functions/v1/send-outbox`, { method: "POST", headers: { "x-outbox-secret": secret, apikey: anon, Authorization: `Bearer ${anon}` } });
    const body = await res.text();
    console.log(`[${new Date().toLocaleTimeString()}] send-outbox ${res.status} ${body}`);
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] send-outbox no respondió: ${error.message}`);
  }
}

console.log(`Disparando send-outbox en ${base} cada ${everyMs / 1000} s. Ctrl+C para parar.`);
await tick();
setInterval(tick, everyMs);
