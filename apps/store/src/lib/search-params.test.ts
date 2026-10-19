import { describe, expect, it } from "vitest";
import { buildQuery, parsePage, parseQuery } from "./search-params";

describe("search-params", () => {
  it("la página inválida vale 1", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("100000")).toBe(1);
  });
  it("la búsqueda se recorta y se vacía", () => {
    expect(parseQuery("  café  ")).toBe("café");
    expect(parseQuery("   ")).toBeNull();
    expect(parseQuery("x".repeat(200))).toHaveLength(80);
  });
  it("arma la cadena de consulta sin vacíos ni página 1", () => {
    expect(buildQuery({ q: "pan", categoria: null, pagina: 1 })).toBe("?q=pan");
    expect(buildQuery({ pagina: 2, q: "" })).toBe("?pagina=2");
    expect(buildQuery({})).toBe("");
  });
});
