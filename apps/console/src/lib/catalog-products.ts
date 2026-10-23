import { normalizeText } from "./directory";

export type ProductStatus = "borrador" | "publicado" | "archivado";

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  storeId: string;
  storeName: string;
  commerceName: string;
  categoryId: string | null;
  brandId: string | null;
  typeId: string | null;
  status: ProductStatus;
  minPrice: number | null;
  activeVariants: number;
  /** Unidades e importe vendidos en el periodo elegido. */
  sold: number;
  revenue: number;
  /** Variantes con stock bajo o agotado (punto de reorden) y, de ellas, las agotadas. */
  reorder: number;
  outOfStock: number;
};

export type ProductFilters = { query: string; status: "todos" | ProductStatus; categoryId: string; storeId: string; reorderOnly: boolean };

/** `categoryId` vacío = todas; `"none"` = productos sin categoría. */
export function filterProducts(rows: ProductRow[], filters: ProductFilters): ProductRow[] {
  const needle = normalizeText(filters.query);
  return rows.filter((row) => {
    if (filters.status !== "todos" && row.status !== filters.status) return false;
    if (filters.categoryId === "none" ? row.categoryId !== null : filters.categoryId !== "" && row.categoryId !== filters.categoryId) return false;
    if (filters.storeId !== "" && row.storeId !== filters.storeId) return false;
    if (filters.reorderOnly && row.reorder === 0) return false;
    if (needle === "") return true;
    return [row.name, row.storeName, row.commerceName].some((text) => normalizeText(text).includes(needle));
  });
}

export function productCounts(rows: ProductRow[]) {
  return {
    todos: rows.length,
    publicado: rows.filter((row) => row.status === "publicado").length,
    borrador: rows.filter((row) => row.status === "borrador").length,
    archivado: rows.filter((row) => row.status === "archivado").length,
    reorder: rows.filter((row) => row.reorder > 0).length,
  };
}
