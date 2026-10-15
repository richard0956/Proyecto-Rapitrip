import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "no autenticado" }, 401);
  const body = await req.json().catch(() => null);
  if (typeof body?.courier_id !== "string") return json({ error: "courier_id es obligatorio" }, 400);

  // La RPC valida el rol y la sesión de consola, y registra la lectura sensible.
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: path, error } = await asCaller.rpc("read_courier_document", { p_id: body.courier_id });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    return json({ error: error.message }, status);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error: signError } = await admin.storage.from("courier-documents").createSignedUrl(path, 60);
  if (signError || !data) return json({ error: "no se pudo generar el enlace" }, 500);
  return json({ url: data.signedUrl, expires_in_seconds: 60 });
});