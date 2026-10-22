import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { createStore } from "./actions";
import { StoresWorkspace, type StoreRow } from "./stores-workspace";

export const metadata = { title: "Mis tiendas" };

export default async function TiendasPage() {
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("stores_list").select("id, name, address, status, closed_until, open_now, hour_ranges, latitude").order("name");
  if (error) console.error("[tiendas]", error.message);

  const rows: StoreRow[] = (data ?? []).flatMap((row) =>
    row.id && row.name ? [{ id: row.id, name: row.name, address: row.address, status: row.status, closed_until: row.closed_until, open_now: row.open_now, hour_ranges: Number(row.hour_ranges ?? 0), located: row.latitude !== null }] : [],
  );

  return (
    <>
      <PageHeader title="Mis tiendas" description="Cada tienda tiene su propio horario, su catálogo y su inventario." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar tus tiendas. Recarga la página.</Alert> : null}
      <StoresWorkspace rows={rows} create={createStore} />
    </>
  );
}
