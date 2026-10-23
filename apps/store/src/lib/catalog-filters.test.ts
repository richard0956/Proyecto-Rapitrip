import { describe, expect, it } from "vitest";
import { activeFilterCount, filtersHref, parseFilters } from "./catalog-filters";

const ID = "11111111-1111-4111-8111-111111111111";

describe("parseFilters", () => {
  it("sin parámetros devuelve los valores por omisión", () => {
    expect(parseFilters({})).toEqual({ q: null, categoria: null, tienda: null, min: null, max: null, orden: "nombre", tipo: null, abiertas: false, descuento: false, pagina: 1 });
  });

  it("lee todos los filtros", () => {
    const f = parseFilters({ q: "  café ", categoria: ID, tienda: ID, min: "10", max: "99,5", orden: "precio_desc", tipo: "empresa", abiertas: "1", pagina: "3" });
    expect(f).toEqual({ q: "café", categoria: ID, tienda: ID, min: 10, max: 99.5, orden: "precio_desc", tipo: "empresa", abiertas: true, descuento: false, pagina: 3 });
  });

  it("ignora valores inválidos en vez de fallar", () => {
    const f = parseFilters({ categoria: "no-es-uuid", tienda: "x", min: "abc", max: "-5", orden: "raro", tipo: "otro", abiertas: "si", pagina: "0" });
    expect(f).toEqual({ q: null, categoria: null, tienda: null, min: null, max: null, orden: "nombre", tipo: null, abiertas: false, descuento: false, pagina: 1 });
  });

  it("acota el texto de búsqueda a 80 caracteres", () => {
    expect(parseFilters({ q: "a".repeat(200) }).q).toHaveLength(80);
  });

  it("si el mínimo supera al máximo, los intercambia", () => {
    const f = parseFilters({ min: "100", max: "20" });
    expect([f.min, f.max]).toEqual([20, 100]);
  });

  it("toma el primer valor si el parámetro viene repetido", () => {
    expect(parseFilters({ tipo: ["informal", "empresa"] }).tipo).toBe("informal");
  });
});

describe("filtersHref", () => {
  const base = parseFilters({});

  it("sin filtros es la dirección base", () => {
    expect(filtersHref("/catalogo", base)).toBe("/catalogo");
  });

  it("solo escribe lo que cambia el valor por omisión", () => {
    expect(filtersHref("/catalogo", { ...base, q: "pan", orden: "recientes" })).toBe("/catalogo?q=pan&orden=recientes");
  });

  it("aplica cambios y reinicia la página cuando se pide", () => {
    const f = parseFilters({ categoria: ID, pagina: "4" });
    expect(filtersHref("/catalogo", f, { categoria: null, pagina: 1 })).toBe("/catalogo");
    expect(filtersHref("/catalogo", f, { pagina: 5 })).toBe(`/catalogo?categoria=${ID}&pagina=5`);
  });
});

describe("activeFilterCount", () => {
  it("cuenta los filtros activos sin el orden ni la página", () => {
    expect(activeFilterCount(parseFilters({ orden: "precio_asc", pagina: "2" }))).toBe(0);
    expect(activeFilterCount(parseFilters({ q: "pan", min: "5", abiertas: "1", tipo: "empresa" }))).toBe(4);
  });
});

describe("filtro de descuento", () => {
  it("se lee de la URL, se escribe de vuelta y cuenta como filtro activo", () => {
    expect(parseFilters({ descuento: "1" }).descuento).toBe(true);
    expect(parseFilters({ descuento: "si" }).descuento).toBe(false);
    expect(filtersHref("/catalogo", parseFilters({ descuento: "1", orden: "descuento" }))).toBe("/catalogo?orden=descuento&descuento=1");
    expect(activeFilterCount(parseFilters({ descuento: "1" }))).toBe(1);
  });

  it("acepta el orden por mayor descuento", () => {
    expect(parseFilters({ orden: "descuento" }).orden).toBe("descuento");
  });
});
