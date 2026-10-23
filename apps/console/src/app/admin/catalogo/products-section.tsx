import { Alert, Card, CardHeader, HBarList, KpiCard } from "@rapitrip/ui";
import { Banknote, Boxes, PackageX, Trophy } from "lucide-react";
import { FilterChips } from "@/components/filter-chips";
import type { ProductRow, ProductStatus } from "@/lib/catalog-products";
import { periodOptions, type Period } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { serverSupabase } from "@/lib/supabase";
import { setProductStatusAsAdmin, updateProductAsAdmin } from "./actions";
import { ProductsTable } from "./products-table";

type Option = { id: string; name: string };

const periodWord = { hoy: "hoy", "7d": "7 días", quincena: "esta quincena", mes: "este mes" } as const;
const isStatus = (value: string | null): value is ProductStatus => value === "borrador" || value === "publicado" || value === "archivado";
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Pestaña «Productos»: cifras del catálogo de todos los comercios, puntos de reorden y la tabla con filtros y edición. */
export async function ProductsSection({ period, categories, brands, types }: { period: Period; categories: Option[]; brands: Option[]; types: Option[] }) {
  const supabase = await serverSupabase();
  const [products, inventory, sales, commerces] = await Promise.all([
    supabase.from("products_list").select("id, store_id, store_name, commerce_id, name, description, category_id, brand_id, product_type_id, status, active_variants, min_price").order("name").limit(1000),
    supabase.from("inventory_list").select("variant_id, product_id, product_name, variant_name, store_name, quantity, low_stock_threshold, stock_state, variant_status").eq("variant_status", "activa").in("stock_state", ["bajo", "agotado"]).order("quantity").limit(1000),
    supabase.rpc("product_sales", { p_from: period.from, p_to: period.to }),
    supabase.from("commerces_list").select("id, name"),
  ]);
  const errors = [products, inventory, sales, commerces].flatMap((result) => (result.error ? [result.error.message] : []));
  if (errors.length > 0) console.error("[catalogo:productos]", errors.join(" | "));

  const commerceName = new Map((commerces.data ?? []).flatMap((row) => (row.id && row.name ? [[row.id, row.name] as const] : [])));
  const soldBy = new Map((sales.data ?? []).flatMap((row) => (row.product_id ? [[row.product_id, { units: Number(row.units ?? 0), revenue: Number(row.sales ?? 0) }] as const] : [])));
  const reorderBy = new Map<string, { reorder: number; out: number }>();
  for (const row of inventory.data ?? []) {
    if (!row.product_id) continue;
    const entry = reorderBy.get(row.product_id) ?? { reorder: 0, out: 0 };
    entry.reorder += 1;
    if (row.stock_state === "agotado") entry.out += 1;
    reorderBy.set(row.product_id, entry);
  }

  const rows: ProductRow[] = (products.data ?? []).flatMap((row) => {
    if (!row.id || !row.name || !row.store_id || !isStatus(row.status)) return [];
    const sold = soldBy.get(row.id);
    const stock = reorderBy.get(row.id);
    return [{ id: row.id, name: row.name, description: row.description, storeId: row.store_id, storeName: row.store_name ?? "", commerceName: commerceName.get(row.commerce_id ?? "") ?? "", categoryId: row.category_id, brandId: row.brand_id, typeId: row.product_type_id, status: row.status, minPrice: row.min_price === null ? null : Number(row.min_price), activeVariants: Number(row.active_variants ?? 0), sold: sold?.units ?? 0, revenue: sold?.revenue ?? 0, reorder: stock?.reorder ?? 0, outOfStock: stock?.out ?? 0 }];
  });

  const published = rows.filter((row) => row.status === "publicado").length;
  const drafts = rows.filter((row) => row.status === "borrador").length;
  const bestSellers = rows.filter((row) => row.sold > 0).sort((a, b) => b.sold - a.sold || b.revenue - a.revenue);
  const best = bestSellers[0];
  const units = sum(rows.map((row) => row.sold));
  const revenue = sum(rows.map((row) => row.revenue));
  const reorderVariants = inventory.data ?? [];
  const outOfStock = reorderVariants.filter((row) => row.stock_state === "agotado").length;
  const word = periodWord[period.key];

  return (
    <>
      {errors.length > 0 ? <Alert tone="error" className="mb-5">No pudimos cargar todas las cifras de productos. Recarga la página.</Alert> : null}
      <div className="mb-5">
        <FilterChips basePath="/admin/catalogo" param="periodo" current={period.key} options={periodOptions} keep={{ pestana: "productos" }} />
      </div>
      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <KpiCard icon={<Boxes className="size-[18px]" />} label="Productos en el catálogo" value={rows.length} hint={`${published} publicados · ${drafts} borradores`} />
        </li>
        <li>
          <KpiCard icon={<Trophy className="size-[18px]" />} tone="lavanda" label={`Más vendido (${word})`} value={best ? best.name : "—"} hint={best ? `${best.sold} u. · ${formatMoney(best.revenue)} · ${best.storeName}` : "Sin ventas en el periodo"} />
        </li>
        <li>
          <KpiCard icon={<Banknote className="size-[18px]" />} label={`Unidades vendidas (${word})`} value={units} hint={`${formatMoney(revenue)} en productos, sin envíos`} />
        </li>
        <li>
          <KpiCard icon={<PackageX className="size-[18px]" />} tone="durazno" label="En punto de reorden" value={reorderVariants.length} hint={`${outOfStock} agotadas · variantes con stock bajo o en cero`} />
        </li>
      </ul>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader title="Productos más vendidos" subtitle={`Unidades, ${word}`} />
          <HBarList items={bestSellers.slice(0, 8).map((row) => ({ label: `${row.name} · ${row.storeName}`, value: row.sold, tone: "hoja" as const }))} formatValue={(n) => `${n} u.`} />
        </Card>
        <Card className="p-5">
          <CardHeader title="Punto de reorden de stock" subtitle="Las variantes más bajas primero" />
          <HBarList
            items={reorderVariants.slice(0, 8).map((row) => ({ label: `${row.product_name ?? "Producto"} · ${row.variant_name ?? ""} (${row.store_name ?? ""}, mín. ${Number(row.low_stock_threshold ?? 0)})`, value: Number(row.quantity ?? 0), tone: row.stock_state === "agotado" ? ("marino" as const) : ("hoja" as const) }))}
            formatValue={(n) => `${n} u.`}
          />
        </Card>
      </div>

      <ProductsTable rows={rows} categories={categories} brands={brands} types={types} periodLabel={word} update={updateProductAsAdmin} setStatus={setProductStatusAsAdmin} />
    </>
  );
}
