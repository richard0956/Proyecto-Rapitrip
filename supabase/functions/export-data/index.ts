import { createClient } from "npm:@supabase/supabase-js@2";
import * as zip from "npm:@zip.js/zip.js@2.23.0";
import { toCsv } from "../_shared/csv.ts";
import { purgeOldExports } from "../_shared/export.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { generatePassphrase } from "../_shared/token.ts";

const DATASETS = ["audit", "login_events", "accounts", "couriers"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "no autenticado" }, 401);
  const body = await req.json().catch(() => null);
  if (!DATASETS.includes(body?.dataset) || typeof body?.reason !== "string") {
    return json({ error: "datos inválidos" }, 400);
  }

  // La RPC valida rol, sesión de consola, MFA reciente y motivo, y registra la exportación.
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await asCaller.rpc("export_dataset", {
    p_dataset: body.dataset,
    p_reason: body.reason,
    p_from: body.from ?? null,
    p_to: body.to ?? null,
  });
  if (error) return json({ error: error.message }, error.code === "42501" ? 403 : 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  await purgeOldExports(admin);

  // El archivo viaja cifrado (ZIP con AES-256). La frase se muestra una sola vez a quien exporta.
  const passphrase = generatePassphrase();
  const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"), {
    password: passphrase,
    encryptionStrength: 3,
  });
  await writer.add(`${body.dataset}.csv`, new zip.TextReader(toCsv(data.rows)));
  const blob = await writer.close();

  const path = `${crypto.randomUUID()}.zip`;
  const upload = await admin.storage.from("exports").upload(path, blob, { contentType: "application/zip" });
  if (upload.error) return json({ error: "no se pudo guardar el archivo" }, 500);
  const signed = await admin.storage.from("exports").createSignedUrl(path, 15 * 60);
  if (signed.error || !signed.data) return json({ error: "no se pudo generar el enlace" }, 500);

  return json({ url: signed.data.signedUrl, passphrase, count: data.count, expires_in_seconds: 900 });
});