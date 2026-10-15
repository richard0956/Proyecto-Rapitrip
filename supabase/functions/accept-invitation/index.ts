import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { sha256Hex } from "../_shared/token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const body = await req.json().catch(() => null);
  const token = body?.token;
  const password = body?.password;
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim().slice(0, 120) : undefined;
  if (typeof token !== "string" || token.length < 40 || token.length > 64) {
    return json({ error: "invitación no válida" }, 400);
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 8 || password.length > 72)) {
    return json({ error: "la contraseña debe tener entre 8 y 72 caracteres" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const hash = await sha256Hex(token);

  const { data: begin, error: beginError } = await admin.rpc("begin_accept_invitation", { p_token_hash: hash });
  if (beginError) return json({ error: "no se pudo validar la invitación" }, 500);
  if (!begin.ok) {
    // Mensaje igual para token inexistente, usado o vencido: no se revela cuál es.
    return json({ error: "la invitación no es válida o ya venció" }, 410);
  }

  const { data: existing } = await admin.rpc("lookup_auth_user", { p_email: begin.email });
  let userId: string;

  if (!existing) {
    if (!password) return json({ error: "elige una contraseña de al menos 8 caracteres" }, 400);
    const { data, error } = await admin.auth.admin.createUser({
      email: begin.email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
    });
    if (error || !data.user) return json({ error: "no se pudo crear la cuenta" }, 500);
    userId = data.user.id;
  } else {
    // Una cuenta existente solo se reutiliza si su correo ya estaba verificado.
    if (!existing.email_confirmed) return json({ error: "la cuenta existente no tiene el correo verificado" }, 409);
    userId = existing.id;
    if (!existing.has_password) {
      // Venía solo de Google: la consola exige contraseña propia.
      if (!password) return json({ error: "elige una contraseña de al menos 8 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: "no se pudo guardar la contraseña" }, 500);
    }
  }

  const { data: done, error: finishError } = await admin.rpc("finish_accept_invitation", {
    p_token_hash: hash,
    p_user: userId,
  });
  if (finishError || !done) return json({ error: "no se pudo completar la invitación" }, 409);
  return json({ ok: true });
});
