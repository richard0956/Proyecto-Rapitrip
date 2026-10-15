import { createClient } from "npm:@supabase/supabase-js@2";
import { purgeOldExports } from "../_shared/export.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("OUTBOX_SECRET");
  if (!secret || req.headers.get("x-outbox-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const removed = await purgeOldExports(admin);
  return new Response(JSON.stringify({ removed }), { headers: { "Content-Type": "application/json" } });
});