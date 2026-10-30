import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("acepta rutas internas con su query", () => {
    expect(safeNext("/ajustes")).toBe("/ajustes");
    expect(safeNext("/vende?paso=2")).toBe("/vende?paso=2");
  });

  it("rechaza destinos externos o ambiguos", () => {
    expect(safeNext("https://malo.example")).toBe("/");
    expect(safeNext("//malo.example")).toBe("/");
    expect(safeNext("/\\malo.example")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("/ruta\nconsalto")).toBe("/");
  });

  it("usa el valor de respaldo si falta", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("", "/ajustes")).toBe("/ajustes");
    expect(safeNext(["/ajustes", "/otra"])).toBe("/ajustes");
  });
});
