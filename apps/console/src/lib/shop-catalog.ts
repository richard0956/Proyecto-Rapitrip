import { normalizeText } from "./directory";

export type ShopProduct = {
  id: string;
  storeId: string;
  name: string;
  status: "borrador" | "publicado" | "archivado";
  activeVariants: number;
  minPrice: number | null;
  cover: string | null;
  category: string | null;
  categoryId: string | null;
  /** Unidades vendidas, pedidos con el producto e importe en el periodo elegido. */
  sold: number;
  orders: number;
  revenue: number;
  /** Unidades apartadas hoy en pedidos sin entregar ni cancelar, y unidades de pedidos cancelados o rechazados en el periodo. */
  reserved: number;
  cancelled: number;
};

export type CatalogFilters = {
  query: string;
  /** «activos» = todo menos los archivados. */
  status: "activos" | "publicado" | "borrador" | "archivado";
  /** Vacío = todas; `"none"` = sin categoría. */
  categoryId: string;
  noSales: boolean;
  sort: "nombre" | "vendidos" | "apartados";
};

export function filterCatalog(rows: ShopProduct[], filters: CatalogFilters): ShopProduct[] {
  const needle = normalizeText(filters.query);
  const kept = rows.filter((row) => {
    if (filters.status === "activos" ? row.status === "archivado" : row.status !== filters.status) return false;
    if (filters.categoryId === "none" ? row.categoryId !== null : filters.categoryId !== "" && row.categoryId !== filters.categoryId) return false;
    if (filters.noSales && row.sold > 0) return false;
    return needle === "" || normalizeText(row.name).includes(needle);
  });
  const byName = (a: ShopProduct, b: ShopProduct) => a.name.localeCompare(b.name, "es");
  if (filters.sort === "vendidos") return kept.sort((a, b) => b.sold - a.sold || byName(a, b));
  if (filters.sort === "apartados") return kept.sort((a, b) => b.reserved - a.reserved || byName(a, b));
  return kept.sort(byName);
}

export function catalogCounts(rows: ShopProduct[]) {
  const live = rows.filter((row) => row.status !== "archivado");
  return {
    activos: live.length,
    publicado: rows.filter((row) => row.status === "publicado").length,
    borrador: rows.filter((row) => row.status === "borrador").length,
    archivado: rows.filter((row) => row.status === "archivado").length,
    sinVentas: live.filter((row) => row.sold === 0).length,
  };
}
