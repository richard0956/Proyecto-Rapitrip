import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { sendMail } from "../_shared/mailer.ts";
import { renderEmail } from "../_shared/templates.ts";
import { generateToken, sha256Hex } from "../_shared/token.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Invita a un repartidor desde su ficha: cuenta y ficha nacen unidas (la invitación genérica no otorga este rol).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "no autenticado" }, 401);

  const body = await req.json().catch(() => null);
  const email = body?.email;
  const courierId = body?.courier_id;
  if (typeof email !== "string" || typeof courierId !== "string" || !UUID.test(courierId)) {
    return json({ error: "datos inválidos" }, 400);
  }

  // La RPC corre con la identidad de quien invita: ahí se valida rol, matriz y sesión de consola.
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const token = generateToken();
  const { data, error } = await asCaller.rpc("create_courier_invitation", {
    p_courier: courierId,
    p_email: email,
    p_token_hash: await sha256Hex(token),
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23505" ? 409 : error.code === "P0002" ? 404 : 400;
    return json({ error: error.message }, status);
  }

  const link = `${Deno.env.get("COURIER_APP_URL")}/aceptar-invitacion?token=${token}`;
  try {
    await sendMail({ to: email.trim().toLowerCase(), ...renderEmail("invitation", { link, role: "repartidor", expiresAt: data.expires_at }) });
  } catch (_e) {
    // Sin correo no hay invitación utilizable: se cancela para no dejar una pendiente huérfana.
    await asCaller.rpc("cancel_invitation", { p_id: data.id });
    return json({ error: "no se pudo enviar el correo de invitación" }, 502);
  }
  return json({ ok: true, invitation_id: data.id, expires_at: data.expires_at });
});
