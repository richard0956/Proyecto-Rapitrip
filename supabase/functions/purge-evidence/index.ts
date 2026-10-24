import { createClient } from "npm:@supabase/supabase-js@2";

// Elimina las fotos de entrega que cumplieron su plazo de conservación (90 días por defecto) o cuyo cliente fue anonimizado.
// Quedan en la base la huella, la hora y las marcas de cada evidencia, no la imagen. Se programa igual que `purge-exports`
// (llamada periódica con el secreto compartido). No borra nada de un pedido con una devolución abierta: la base no lo lista.
const BUCKET = "entregas";

Deno.serve(async (req) => {
  const secret = Deno.env.get("OUTBOX_SECRET");
  if (!secret || req.headers.get("x-outbox-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.rpc("evidence_pending_purge", { p_limit: 200 });
  if (error) return new Response(JSON.stringify({ error: "no se pudo leer la lista" }), { status: 500 });
  const rows = (data ?? []) as { evidence_id: string; file_path: string }[];
  if (rows.length === 0) return jsonResponse({ removed: 0 });

  // Borrar primero el archivo y marcar después: si algo falla a medias, la próxima pasada lo reintenta.
  const { error: removeError } = await admin.storage.from(BUCKET).remove(rows.map((row) => row.file_path));
  if (removeError) return new Response(JSON.stringify({ error: "no se pudieron borrar las fotos" }), { status: 500 });

  const { data: marked, error: markError } = await admin.rpc("mark_evidence_purged", { p_ids: rows.map((row) => row.evidence_id) });
  if (markError) return new Response(JSON.stringify({ error: "no se pudo marcar lo eliminado" }), { status: 500 });
  return jsonResponse({ removed: marked ?? 0 });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}
