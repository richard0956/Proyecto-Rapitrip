import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatStoreDateTime } from "@/lib/stores";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { changeStock, setStockTracking } from "./actions";
import { InventoryWorkspace, type InventoryRow, type Movement } from "./inventory-workspace";

export const metadata = { title: "Inventario" };

const states = ["sin_control", "agotado", "bajo", "disponible"] as const;

export default async function InventarioPage() {
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const [stores, items, movements] = await Promise.all([
    supabase.from("stores_list").select("id, name").order("name"),
    supabase.from("inventory_list").select("*").order("product_name"),
    supabase.from("stock_movements_list").select("variant_id, kind, delta, quantity_after, reason, created_at").order("id", { ascending: false }).limit(300),
  ]);
  const failed = stores.error || items.error || movements.error;
  if (failed) console.error("[inventario]", stores.error?.message, items.error?.message, movements.error?.message);

  const rows: InventoryRow[] = (items.data ?? []).flatMap((row) => {
    const state = states.find((item) => item === row.stock_state);
    return row.variant_id && row.store_id && row.product_name && row.variant_name && row.sku && state
      ? [
          {
            variantId: row.variant_id,
            storeId: row.store_id,
            product: row.product_name,
            variant: row.variant_name,
            sku: row.sku,
            productStatus: row.product_status ?? "borrador",
            active: row.variant_status !== "inactiva",
            track: Boolean(row.track_stock),
            quantity: Number(row.quantity ?? 0),
            threshold: Number(row.low_stock_threshold ?? 5),
            state,
          },
        ]
      : [];
  });
  const history: Movement[] = (movements.data ?? []).flatMap((row) =>
    row.variant_id && (row.kind === "entrada" || row.kind === "salida" || row.kind === "conteo") ? [{ variantId: row.variant_id, kind: row.kind, delta: Number(row.delta ?? 0), after: Number(row.quantity_after ?? 0), reason: row.reason ?? "", when: formatStoreDateTime(row.created_at) }] : [],
  );

  return (
    <>
      <PageHeader title="Inventario" description="Controla las existencias por variante. Una variante agotada no se muestra a los clientes." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar el inventario. Recarga la página.</Alert> : null}
      <InventoryWorkspace stores={(stores.data ?? []).flatMap((row) => (row.id && row.name ? [{ id: row.id, name: row.name }] : []))} rows={rows} history={history} setTracking={setStockTracking} change={changeStock} />
    </>
  );
}
