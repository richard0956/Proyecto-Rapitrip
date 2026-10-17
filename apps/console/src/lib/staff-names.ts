import { serverSupabase } from "./supabase";

/** Nombre visible por cuenta, a partir de `accounts_staff` (que RLS limita a la consola de administración). */
export async function staffNames() {
  const supabase = await serverSupabase();
  const { data } = await supabase.from("accounts_staff").select("user_id, full_name, email");
  const names = new Map<string, string>();
  const people: { id: string; label: string }[] = [];
  for (const row of data ?? []) {
    if (!row.user_id || names.has(row.user_id)) continue;
    const label = row.full_name ?? row.email ?? row.user_id.slice(0, 8);
    names.set(row.user_id, label);
    people.push({ id: row.user_id, label });
  }
  people.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return { names, people, label: (id: string | null | undefined) => (id ? (names.get(id) ?? `Cuenta ${id.slice(0, 8)}`) : "Sistema") };
}
