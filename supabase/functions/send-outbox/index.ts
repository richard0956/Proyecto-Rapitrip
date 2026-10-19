import { createClient } from "npm:@supabase/supabase-js@2";
import { sendMail } from "../_shared/mailer.ts";
import { renderEmail, type TemplateName } from "../_shared/templates.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("OUTBOX_SECRET");
  if (!secret || req.headers.get("x-outbox-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await admin.rpc("claim_outbox", { p_limit: 20 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    try {
      const data = { ...row.data, console_url: Deno.env.get("CONSOLE_URL") ?? "", store_url: Deno.env.get("STORE_URL") ?? "" };
      const mail = renderEmail(row.template as TemplateName, data);
      await sendMail({ to: row.to_email, ...mail });
      await admin.rpc("mark_outbox", { p_id: row.id, p_ok: true });
      sent++;
    } catch (e) {
      await admin.rpc("mark_outbox", { p_id: row.id, p_ok: false, p_error: String(e) });
      failed++;
    }
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { "Content-Type": "application/json" } });
});