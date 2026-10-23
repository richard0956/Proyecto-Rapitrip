import { Alert } from "@rapitrip/ui";
import { FilterChips } from "@/components/filter-chips";
import { PageHeader } from "@/components/shell";
import { parsePeriod, periodOptions } from "@/lib/dashboard";
import { first, optionalUuid, type SearchParams } from "@/lib/filters";
import { requireConsoleAccess } from "@/lib/guard";
import { productImageUrl } from "@/lib/money";
import type { ShopProduct } from "@/lib/shop-catalog";
import { serverSupabase } from "@/lib/supabase";
import { createProduct, productFlow } from "./actions";
import { CatalogWorkspace, type MasterOption } from "./catalog-workspace";

export const metadata = { title: "Catálogo" };

const periodWord = { hoy: "hoy", "7d": "los últimos 7 días", quincena: "esta quincena", mes: "este mes" } as const;

export default async function CatalogoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tienda = optionalUuid.parse(first(params.tienda));
  await requireConsoleAccess("comercio");
  const period = parsePeriod(first(params.periodo));
  const supabase = await serverSupabase();
  const [stores, products, master, stats] = await Promise.all([
    supabase.from("stores_list").select("id, name, status").order("name"),
    supabase.from("products_list").select("id, store_id, name, status, active_variants, min_price, cover_path, category_id").order("name"),
    supabase.from("master_items_list").select("id, kind, name"),
    supabase.rpc("product_stats", { p_from: period.from, p_to: period.to }),
  ]);
  const failed = stores.error || products.error || stats.error;
  if (failed) console.error("[catalogo]", stores.error?.message, products.error?.message, stats.error?.message);

  const storeList = (stores.data ?? []).flatMap((row) => (row.id && row.name ? [{ id: row.id, name: row.name, active: row.status === "activa" }] : []));
  const categories = new Map((master.data ?? []).filter((row) => row.kind === "categoria" && row.id).map((row) => [row.id as string, row.name as string]));
  const options: MasterOption[] = (master.data ?? []).flatMap((row) => (row.id && row.name && (row.kind === "categoria" || row.kind === "marca" || row.kind === "tipo_producto") ? [{ id: row.id, kind: row.kind, name: row.name }] : []));
  const statsById = new Map((stats.data ?? []).flatMap((row) => (row.product_id ? [[row.product_id, row] as const] : [])));

  const rows: ShopProduct[] = (products.data ?? []).flatMap((row) => {
    if (!row.id || !row.store_id || !row.name) return [];
    const stat = statsById.get(row.id);
    return [
      {
        id: row.id,
        storeId: row.store_id,
        name: row.name,
        status: row.status === "publicado" || row.status === "archivado" ? row.status : ("borrador" as const),
        activeVariants: Number(row.active_variants ?? 0),
        minPrice: row.min_price === null ? null : Number(row.min_price),
        cover: productImageUrl(row.cover_path),
        category: row.category_id ? (categories.get(row.category_id) ?? null) : null,
        categoryId: row.category_id,
        sold: Number(stat?.units ?? 0),
        orders: Number(stat?.orders ?? 0),
        revenue: Number(stat?.sales ?? 0),
        reserved: Number(stat?.reserved_units ?? 0),
        cancelled: Number(stat?.cancelled_units ?? 0),
      },
    ];
  });
  const categoryOptions = [...categories.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <>
      <PageHeader title="Catálogo" description="Productos de cada tienda, con sus variantes, precios e imágenes, y cómo se están moviendo." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo el catálogo. Recarga la página.</Alert> : null}
      <div className="mb-5">
        <FilterChips basePath="/comercio/catalogo" param="periodo" current={period.key} options={periodOptions} keep={{ tienda }} />
      </div>
      <CatalogWorkspace stores={storeList} rows={rows} options={options} categories={categoryOptions} selectedStore={tienda ?? null} create={createProduct} periodLabel={periodWord[period.key]} loadFlow={productFlow.bind(null, period.key)} />
    </>
  );
}
