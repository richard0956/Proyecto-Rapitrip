import { describe, expect, it } from "vitest";
import { catalogCounts, filterCatalog, type CatalogFilters, type ShopProduct } from "./shop-catalog";

const base: ShopProduct = { id: "1", storeId: "s1", name: "Café molido", status: "publicado", activeVariants: 1, minPrice: 150, cover: null, category: "Bebidas", categoryId: "c1", sold: 10, orders: 4, revenue: 1500, reserved: 0, cancelled: 0 };
const rows: ShopProduct[] = [
  base,
  { ...base, id: "2", name: "Azúcar", status: "borrador", category: null, categoryId: null, sold: 0, orders: 0, revenue: 0, reserved: 5 },
  { ...base, id: "3", name: "Té verde", categoryId: "c2", category: "Infusiones", sold: 25, orders: 9, reserved: 2 },
  { ...base, id: "4", name: "Panela", status: "archivado", sold: 0, orders: 0, revenue: 0 },
];
const all: CatalogFilters = { query: "", status: "activos", categoryId: "", noSales: false, sort: "nombre" };
const ids = (list: ShopProduct[]) => list.map((row) => row.id);

describe("filtros del catálogo del comercio", () => {
  it("por defecto oculta los archivados y ordena por nombre", () => {
    expect(ids(filterCatalog(rows, all))).toEqual(["2", "1", "3"]);
  });

  it("filtra por estado, incluidos los archivados", () => {
    expect(ids(filterCatalog(rows, { ...all, status: "borrador" }))).toEqual(["2"]);
    expect(ids(filterCatalog(rows, { ...all, status: "archivado" }))).toEqual(["4"]);
    expect(ids(filterCatalog(rows, { ...all, status: "publicado" }))).toEqual(["1", "3"]);
  });

  it("busca sin importar acentos ni mayúsculas", () => {
    expect(ids(filterCatalog(rows, { ...all, query: "AZUCAR" }))).toEqual(["2"]);
    expect(ids(filterCatalog(rows, { ...all, query: "te " }))).toEqual(["3"]);
  });

  it("filtra por categoría y por «sin categoría»", () => {
    expect(ids(filterCatalog(rows, { ...all, categoryId: "c2" }))).toEqual(["3"]);
    expect(ids(filterCatalog(rows, { ...all, categoryId: "none" }))).toEqual(["2"]);
  });

  it("«sin ventas» deja los productos que no se vendieron en el periodo", () => {
    expect(ids(filterCatalog(rows, { ...all, noSales: true }))).toEqual(["2"]);
  });

  it("ordena por más vendidos y por más apartados", () => {
    expect(ids(filterCatalog(rows, { ...all, sort: "vendidos" }))).toEqual(["3", "1", "2"]);
    expect(ids(filterCatalog(rows, { ...all, sort: "apartados" }))).toEqual(["2", "3", "1"]);
  });

  it("cuenta para las píldoras", () => {
    expect(catalogCounts(rows)).toEqual({ activos: 3, publicado: 2, borrador: 1, archivado: 1, sinVentas: 1 });
  });
});
