import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { sendMail } from "../_shared/mailer.ts";
import { renderEmail } from "../_shared/templates.ts";
import { generateToken, sha256Hex } from "../_shared/token.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cuenta de consola de un comercio (Zero Trust: nunca es la cuenta de la tienda de quien lo pidió).
 *   { request_id, console_email? }  aprueba la solicitud: crea el comercio e invita al correo de la consola.
 *   { commerce_id, email }          vuelve a invitar desde la ficha del comercio (si venció o hay que cambiar el correo).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "no autenticado" }, 401);

  const body = await req.json().catch(() => null);
  const requestId = body?.request_id;
  const commerceId = body?.commerce_id;
  const consoleEmail = typeof body?.console_email === "string" && body.console_email.trim() ? body.console_email.trim() : null;
  const email = typeof body?.email === "string" ? body.email.trim() : null;
  const approving = typeof requestId === "string" && UUID.test(requestId);
  if (!approving && !(typeof commerceId === "string" && UUID.test(commerceId) && email)) {
    return json({ error: "datos inválidos" }, 400);
  }

  // Las RPC corren con la identidad de quien aprueba: ahí se validan rol, matriz y sesión de consola.
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const { data, error } = approving
    ? await asCaller.rpc("approve_commerce_request", { p_request: requestId, p_convenio_confirmed: true, p_token_hash: tokenHash, p_console_email: consoleEmail })
    : await asCaller.rpc("create_commerce_invitation", { p_commerce: commerceId, p_email: email, p_token_hash: tokenHash });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23505" ? 409 : error.code === "P0002" ? 404 : 400;
    return json({ error: error.message }, status);
  }

  const link = `${Deno.env.get("CONSOLE_URL")}/aceptar-invitacion?token=${token}`;
  try {
    await sendMail({ to: String(data.email), ...renderEmail("invitation", { link, role: "comercio", expiresAt: data.expires_at }) });
  } catch (_e) {
    // Sin correo no hay invitación utilizable: se cancela. Si era una aprobación, el comercio ya quedó creado y se reinvita desde su ficha.
    await asCaller.rpc("cancel_invitation", { p_id: data.id });
    return json({ error: approving ? "el comercio quedó aprobado, pero no se pudo enviar la invitación: reenvíala desde su ficha" : "no se pudo enviar el correo de invitación" }, 502);
  }
  return json({ ok: true, invitation_id: data.id, expires_at: data.expires_at, email: data.email, commerce_id: data.commerce_id ?? commerceId });
});
