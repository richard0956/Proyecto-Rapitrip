import type { Database } from "@rapitrip/db-types";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { CatalogFilters, CommerceKind } from "./catalog-filters";

/**
 * Lectura pública del catálogo: funciones `catalog_*` y `quote_cart` de la base de datos, con la llave anónima y sin cookies.
 * Las lecturas se guardan 60 segundos en la caché de Next (la consola y la tienda son apps separadas: una no puede invalidar
 * la caché de la otra, así que la caducidad es por tiempo). `quote_cart` nunca se cachea: siempre muestra precios y stock de ahora.
 */
export const CATALOG_REVALIDATE_SECONDS = 60;
export const PAGE_SIZE = 24;

export type StoreSummary = {
  id: string;
  name: string;
  address: string | null;
  delivery_fee: number;
  open_now: boolean;
  closed_until: string | null;
  closed_reason: string | null;
  product_count: number;
  /** Solo lo devuelve `catalog_search_stores`. */
  commerce_kind?: CommerceKind;
  categories?: string[];
};

export type StoreDetail = {
  id: string;
  name: string;
  address: string | null;
  delivery_fee: number;
  open_now: boolean;
  closed_until: string | null;
  closed_reason: string | null;
  hours: { weekday: number; opens: string; closes: string }[];
};

export type Category = { id: string; name: string; product_count: number };

export type ProductSummary = {
  id: string;
  store_id: string;
  store_name: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  min_price: number | null;
  cover_path: string | null;
};

/** Tarjeta de producto del catálogo con filtros (`catalog_search_products`). */
export type CatalogProduct = ProductSummary & {
  variant_count: number;
  /** La variante disponible más barata: la que agrega el botón rápido de la tarjeta. */
  quick_variant_id: string;
  quick_variant_name: string;
  quick_max: number | null;
  commerce_kind: CommerceKind;
  store_open: boolean;
  created_at: string;
  brand_name: string | null;
  total_count: number;
};

export type ProductVariant = { id: string; name: string; price: number; available: boolean; max_per_order: number | null };

export type ProductDetail = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  brand_name?: string | null;
  store: { id: string; name: string; delivery_fee: number; open_now: boolean; commerce_kind?: CommerceKind; closed_until: string | null; closed_reason: string | null };
  images: string[];
  variants: ProductVariant[];
};

export type QuoteProblemCode = "tienda_no_disponible" | "tienda_cerrada" | "producto_no_disponible" | "sin_stock" | "precio_cambiado" | "cantidad_invalida";

export type QuoteProblem = {
  code: QuoteProblemCode;
  variant_id?: string;
  product_name?: string;
  max_per_order?: number | null;
  old_price?: number;
  new_price?: number;
};

export type QuoteLine = {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  cover_path: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  available: boolean;
  max_per_order: number | null;
};

export type Quote = {
  store: { id: string; name: string; open_now: boolean } | null;
  lines: QuoteLine[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  problems: QuoteProblem[];
};

/** Cliente anónimo sin sesión ni cookies: lo único que ve es lo público. */
export function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const options = { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["catalog"] };

/** Error de lectura: la página muestra su estado de error en vez de un catálogo vacío engañoso. */
function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
}

export const getStores = unstable_cache(
  async (openOnly: boolean, page: number) =>
    must(
      await publicSupabase().rpc("catalog_stores", { p_open_only: openOnly, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
      "tiendas",
    ) as StoreSummary[],
  ["catalog-stores"],
  options,
);

export const getStore = unstable_cache(
  async (id: string) => must(await publicSupabase().rpc("catalog_store", { p_store: id }), "tienda") as StoreDetail | null,
  ["catalog-store"],
  options,
);

export const getCategories = unstable_cache(
  async (storeId: string | null) =>
    must(await publicSupabase().rpc("catalog_categories", storeId ? { p_store: storeId } : {}), "categorías") as Category[],
  ["catalog-categories"],
  options,
);

export const getProducts = unstable_cache(
  async (storeId: string | null, categoryId: string | null, query: string | null, page: number) =>
    must(
      await publicSupabase().rpc("catalog_products", {
        ...(storeId ? { p_store: storeId } : {}),
        ...(categoryId ? { p_category: categoryId } : {}),
        ...(query ? { p_query: query } : {}),
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      }),
      "productos",
    ) as ProductSummary[],
  ["catalog-products"],
  options,
);

/** Catálogo con la barra de filtros. `store` fija una tienda (la página de la tienda); el resto viene de la URL. */
export const searchProducts = unstable_cache(
  async (filters: Omit<CatalogFilters, "pagina" | "tienda">, store: string | null, page: number) =>
    must(
      await publicSupabase().rpc("catalog_search_products", {
        ...(store ? { p_store: store } : {}),
        ...(filters.categoria ? { p_category: filters.categoria } : {}),
        ...(filters.q ? { p_query: filters.q } : {}),
        ...(filters.min !== null ? { p_min_price: filters.min } : {}),
        ...(filters.max !== null ? { p_max_price: filters.max } : {}),
        ...(filters.tipo ? { p_kind: filters.tipo } : {}),
        ...(filters.abiertas ? { p_open_only: true } : {}),
        p_sort: filters.orden,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      }),
      "productos",
    ) as CatalogProduct[],
  ["catalog-search-products"],
  options,
);

/** Tiendas con filtros (búsqueda por nombre, tipo de vendedor, categoría y solo abiertas). */
export const searchStores = unstable_cache(
  async (filters: Pick<CatalogFilters, "q" | "tipo" | "categoria" | "abiertas">, page: number, limit: number = PAGE_SIZE) =>
    must(
      await publicSupabase().rpc("catalog_search_stores", {
        p_open_only: filters.abiertas,
        ...(filters.q ? { p_query: filters.q } : {}),
        ...(filters.tipo ? { p_kind: filters.tipo } : {}),
        ...(filters.categoria ? { p_category: filters.categoria } : {}),
        p_limit: limit,
        p_offset: (page - 1) * limit,
      }),
      "tiendas",
    ) as StoreSummary[],
  ["catalog-search-stores"],
  options,
);

export const getProduct = unstable_cache(
  async (id: string) => must(await publicSupabase().rpc("catalog_product", { p_product: id }), "producto") as ProductDetail | null,
  ["catalog-product"],
  options,
);

/** Cotización de ahora, sin caché. Sirve con o sin sesión. */
export async function quoteCart(storeId: string, items: { variant_id: string; quantity: number; seen_price?: number }[]): Promise<Quote> {
  const result = await publicSupabase().rpc("quote_cart", { p_store: storeId, p_items: items });
  return must(result, "cotización") as Quote;
}

export function isUuid(value: string | undefined | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
