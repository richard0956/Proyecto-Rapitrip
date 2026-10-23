import { describe, expect, it } from "vitest";
import { filterProducts, productCounts, type ProductRow } from "./catalog-products";

const base: ProductRow = { id: "1", name: "Café molido", description: null, storeId: "s1", storeName: "Tienda Central", commerceName: "Cafetales SA", categoryId: "c1", brandId: null, typeId: null, status: "publicado", minPrice: 150, activeVariants: 1, sold: 0, revenue: 0, reorder: 0, outOfStock: 0 };
const rows: ProductRow[] = [
  base,
  { ...base, id: "2", name: "Té verde", storeId: "s2", storeName: "Tienda Norte", commerceName: "Hierbas Núñez", categoryId: "c2", status: "borrador", reorder: 1 },
  { ...base, id: "3", name: "Azúcar", storeId: "s1", categoryId: null, status: "archivado", sold: 12, revenue: 600, outOfStock: 1, reorder: 1 },
];
const none = { query: "", status: "todos" as const, categoryId: "", storeId: "", reorderOnly: false };

describe("filtros del catálogo de productos", () => {
  it("busca por producto, tienda o comercio sin importar acentos", () => {
    expect(filterProducts(rows, { ...none, query: "cafe" }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterProducts(rows, { ...none, query: "nunez" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterProducts(rows, { ...none, query: "tienda norte" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("filtra por estado, categoría y tienda, y combina los filtros", () => {
    expect(filterProducts(rows, { ...none, status: "borrador" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterProducts(rows, { ...none, categoryId: "c2" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterProducts(rows, { ...none, storeId: "s1" }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterProducts(rows, { ...none, storeId: "s1", status: "archivado" }).map((r) => r.id)).toEqual(["3"]);
  });

  it("«sin categoría» encuentra los que no tienen", () => {
    expect(filterProducts(rows, { ...none, categoryId: "none" }).map((r) => r.id)).toEqual(["3"]);
  });

  it("«en reorden» deja solo los productos con variantes bajas o agotadas", () => {
    expect(filterProducts(rows, { ...none, reorderOnly: true }).map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("cuenta por estado y en reorden para las píldoras", () => {
    expect(productCounts(rows)).toEqual({ todos: 3, publicado: 1, borrador: 1, archivado: 1, reorder: 2 });
  });
});
