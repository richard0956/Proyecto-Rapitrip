import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { sendWebPush, type VapidKeys } from "../_shared/webpush.ts";

// Vacía la cola de avisos push de los repartidores (ver la migración 77). La puede disparar:
//   · el programador, cada minuto, con el secreto compartido (cabecera x-outbox-secret), o
//   · la consola de coordinación al proponer un pedido, con la sesión de quien propone (así el aviso sale al instante).
// El aviso es genérico: nunca lleva datos del cliente ni del pedido; el repartidor los ve al abrir la aplicación.

type Row = {
  outbox_id: string; kind: string; offer_id: string | null; expires_at: string;
  subscription_id: string; endpoint: string; p256dh: string; auth: string;
};

function messageFor(kind: string, offerId: string | null) {
  if (kind === "oferta_cancelada") {
    // Mensaje silencioso: el service worker cierra la notificación de esa propuesta y no muestra nada nuevo.
    return { kind, tag: offerId ? `oferta-${offerId}` : "oferta", close: true };
  }
  return {
    kind,
    tag: offerId ? `oferta-${offerId}` : "oferta",
    title: "Nueva propuesta de pedido",
    body: "Tienes unos minutos para responder. Ábrela en Rapitrip.",
    url: "/",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  // Quién llama: el programador (secreto) o coordinación (sesión).
  const secret = Deno.env.get("OUTBOX_SECRET");
  const hasSecret = Boolean(secret) && req.headers.get("x-outbox-secret") === secret;
  if (!hasSecret) {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "no autorizado" }, 403);
    const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { error } = await asCaller.rpc("push_kick");
    if (error) return json({ error: "no autorizado" }, 403);
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return json({ error: "faltan las claves VAPID" }, 500);
  const vapid: VapidKeys = { publicKey, privateKey, subject };

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.rpc("claim_push", { p_limit: 20 });
  if (error) return json({ error: "no se pudo leer la cola" }, 500);

  // Una fila por aviso y dispositivo: se agrupan por aviso.
  const byMessage = new Map<string, Row[]>();
  for (const row of (data ?? []) as Row[]) {
    byMessage.set(row.outbox_id, [...(byMessage.get(row.outbox_id) ?? []), row]);
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const [outboxId, rows] of byMessage) {
    const first = rows[0];
    const remaining = Math.floor((new Date(first.expires_at).getTime() - Date.now()) / 1000);
    const message = messageFor(first.kind, first.offer_id);
    const results = await Promise.all(
      rows.map((row) =>
        sendWebPush(
          { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
          message,
          vapid,
          // Un servicio push guarda el aviso mientras el teléfono no responde, pero nunca más allá de la propuesta.
          { ttl: Math.max(30, Math.min(remaining, 300)), urgency: "high", topic: message.tag.slice(0, 32) },
        ),
      ),
    );
    const gone = rows.filter((_, i) => results[i].gone).map((row) => row.subscription_id);
    const anyOk = results.some((r) => r.ok);
    const lastError = results.find((r) => !r.ok && !r.gone);
    await admin.rpc("finish_push", {
      p_outbox: outboxId,
      // Si todos los dispositivos fueron dados por inexistentes no hay nada que reintentar.
      p_sent: anyOk || gone.length === rows.length,
      p_error: anyOk ? null : lastError ? `respondió ${lastError.status}${lastError.error ? `: ${lastError.error}` : ""}` : "dispositivo inexistente",
      p_gone: gone,
    });
    removed += gone.length;
    if (anyOk) sent++;
    else failed++;
  }
  return json({ sent, failed, removed });
});
