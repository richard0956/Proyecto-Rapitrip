import { describe, expect, it } from "vitest";
import { filterDirectory, normalizeText, statusCounts, type DirectoryRow } from "./directory";

const row = (over: Partial<DirectoryRow>): DirectoryRow => ({ id: "1", name: "Café", ruc: null, status: "activo", stores: 1, accounts: 1, createdAt: "1 oct 2026", ...over });
const rows = [
  row({ id: "1", name: "Panadería La Esperanza" }),
  row({ id: "2", name: "Ferretería Núñez", ruc: "J0310000123456", status: "suspendido" }),
  row({ id: "3", name: "Café Aroma", ruc: "J0310000999999" }),
];

describe("directorio de comercios y vendedores", () => {
  it("normaliza acentos y mayúsculas", () => {
    expect(normalizeText("  Ferretería NÚÑEZ ")).toBe("ferreteria nunez");
  });

  it("busca por nombre sin importar acentos ni mayúsculas", () => {
    expect(filterDirectory(rows, { query: "panaderia", status: "todos" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterDirectory(rows, { query: "NUNEZ", status: "todos" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("busca también por RUC", () => {
    expect(filterDirectory(rows, { query: "0310000999", status: "todos" }).map((r) => r.id)).toEqual(["3"]);
  });

  it("filtra por estado y combina con la búsqueda", () => {
    expect(filterDirectory(rows, { query: "", status: "suspendido" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterDirectory(rows, { query: "cafe", status: "suspendido" })).toEqual([]);
    expect(filterDirectory(rows, { query: "cafe", status: "activo" }).map((r) => r.id)).toEqual(["3"]);
  });

  it("una búsqueda vacía o solo de espacios no filtra", () => {
    expect(filterDirectory(rows, { query: "   ", status: "todos" })).toHaveLength(3);
  });

  it("cuenta por estado para las píldoras", () => {
    expect(statusCounts(rows)).toEqual({ todos: 3, activo: 2, suspendido: 1 });
  });
});
