import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Borra del bucket `exports` los archivos de más de `maxAgeHours` horas. */
export async function purgeOldExports(admin: SupabaseClient, maxAgeHours = 24): Promise<number> {
  const { data, error } = await admin.storage.from("exports").list("", { limit: 1000 });
  if (error || !data) return 0;
  const cutoff = Date.now() - maxAgeHours * 3_600_000;
  const old = data
    .filter((f) => f.created_at && new Date(f.created_at).getTime() < cutoff)
    .map((f) => f.name);
  if (old.length === 0) return 0;
  await admin.storage.from("exports").remove(old);
  return old.length;
}