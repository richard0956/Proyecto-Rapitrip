import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { sendMail } from "../_shared/mailer.ts";
import { renderEmail } from "../_shared/templates.ts";
import { generateToken, sha256Hex } from "../_shared/token.ts";

const INVITABLE = ["admin", "cajero", "coordinador"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "no autenticado" }, 401);

  const body = await req.json().catch(() => null);
  const email = body?.email;
  const role = body?.role;
  if (typeof email !== "string" || !INVITABLE.includes(role)) {
    return json({ error: "datos inválidos" }, 400);
  }

  // La RPC corre con la identidad de quien invita: ahí se valida rol, matriz y sesión de consola.
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const token = generateToken();
  const { data, error } = await asCaller.rpc("create_invitation", {
    p_email: email,
    p_role: role,
    p_token_hash: await sha256Hex(token),
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
    return json({ error: error.message }, status);
  }

  const link = `${Deno.env.get("CONSOLE_URL")}/aceptar-invitacion?token=${token}`;
  try {
    await sendMail({ to: email.trim().toLowerCase(), ...renderEmail("invitation", { link, role, expiresAt: data.expires_at }) });
  } catch (_e) {
    // Sin correo no hay invitación utilizable: se cancela para no dejar una pendiente huérfana.
    await asCaller.rpc("cancel_invitation", { p_id: data.id });
    return json({ error: "no se pudo enviar el correo de invitación" }, 502);
  }
  return json({ ok: true, invitation_id: data.id, expires_at: data.expires_at });
});