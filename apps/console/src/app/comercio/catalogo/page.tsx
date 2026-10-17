import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { productImageUrl } from "@/lib/money";
import { serverSupabase } from "@/lib/supabase";
import { createProduct } from "./actions";
import { CatalogWorkspace, type MasterOption, type ProductRow } from "./catalog-workspace";

export const metadata = { title: "Catálogo" };

export default async function CatalogoPage({ searchParams }: { searchParams: Promise<{ tienda?: string }> }) {
  const { tienda } = await searchParams;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const [stores, products, master] = await Promise.all([
    supabase.from("stores_list").select("id, name, status").order("name"),
    supabase.from("products_list").select("id, store_id, name, status, active_variants, min_price, cover_path, category_id").order("name"),
    supabase.from("master_items_list").select("id, kind, name"),
  ]);
  const failed = stores.error || products.error;
  if (failed) console.error("[catalogo]", stores.error?.message, products.error?.message);

  const storeList = (stores.data ?? []).flatMap((row) => (row.id && row.name ? [{ id: row.id, name: row.name, active: row.status === "activa" }] : []));
  const categories = new Map((master.data ?? []).filter((row) => row.kind === "categoria" && row.id).map((row) => [row.id as string, row.name as string]));
  const options: MasterOption[] = (master.data ?? []).flatMap((row) => (row.id && row.name && (row.kind === "categoria" || row.kind === "marca" || row.kind === "tipo_producto") ? [{ id: row.id, kind: row.kind, name: row.name }] : []));

  const rows: ProductRow[] = (products.data ?? []).flatMap((row) =>
    row.id && row.store_id && row.name
      ? [
          {
            id: row.id,
            storeId: row.store_id,
            name: row.name,
            status: row.status === "publicado" || row.status === "archivado" ? row.status : ("borrador" as const),
            activeVariants: Number(row.active_variants ?? 0),
            minPrice: row.min_price === null ? null : Number(row.min_price),
            cover: productImageUrl(row.cover_path),
            category: row.category_id ? (categories.get(row.category_id) ?? null) : null,
          },
        ]
      : [],
  );

  return (
    <>
      <PageHeader title="Catálogo" description="Productos de cada tienda, con sus variantes, precios e imágenes." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar el catálogo. Recarga la página.</Alert> : null}
      <CatalogWorkspace stores={storeList} rows={rows} options={options} selectedStore={tienda ?? null} create={createProduct} />
    </>
  );
}
