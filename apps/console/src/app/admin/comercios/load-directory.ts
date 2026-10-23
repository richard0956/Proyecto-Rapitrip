import { formatDate } from "@/lib/format";
import type { DirectoryRow } from "@/lib/directory";
import { serverSupabase } from "@/lib/supabase";

/** Filas del directorio de comercios (empresas con RUC) o de vendedores (vendedores propios, sin RUC). */
export async function loadDirectory(kind: "empresa" | "informal"): Promise<{ rows: DirectoryRow[]; failed: boolean }> {
  const supabase = await serverSupabase();
  const [commerces, accounts, stores] = await Promise.all([
    supabase.from("commerces_list").select("id, name, kind, ruc, status, created_at").eq("kind", kind).order("created_at", { ascending: false }),
    supabase.from("accounts_staff").select("commerce_id, role_status").eq("role", "comercio"),
    supabase.from("stores_list").select("commerce_id, status"),
  ]);
  const failed = Boolean(commerces.error || accounts.error || stores.error);
  if (failed) console.error("[directorio]", kind, commerces.error?.message, accounts.error?.message, stores.error?.message);

  const storeCount = new Map<string, number>();
  for (const row of stores.data ?? []) if (row.commerce_id && row.status === "activa") storeCount.set(row.commerce_id, (storeCount.get(row.commerce_id) ?? 0) + 1);
  const activeUsers = new Map<string, number>();
  for (const row of accounts.data ?? []) if (row.commerce_id && row.role_status === "activo") activeUsers.set(row.commerce_id, (activeUsers.get(row.commerce_id) ?? 0) + 1);

  const rows = (commerces.data ?? []).flatMap((row) =>
    row.id && row.name ? [{ id: row.id, name: row.name, ruc: row.ruc, status: row.status === "activo" ? ("activo" as const) : ("suspendido" as const), stores: storeCount.get(row.id) ?? 0, accounts: activeUsers.get(row.id) ?? 0, createdAt: formatDate(row.created_at) }] : [],
  );
  return { rows, failed };
}
