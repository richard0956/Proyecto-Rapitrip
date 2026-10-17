import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDraft, takeDraft } from "./draft";

beforeEach(() => sessionStorage.clear());

describe("borradores de formulario", () => {
  it("guarda y devuelve el borrador una sola vez", () => {
    saveDraft("k", { nombre: "Ana" });
    expect(takeDraft("k")).toEqual({ nombre: "Ana" });
    expect(takeDraft("k")).toBeNull();
  });

  it("no falla si el almacenamiento está bloqueado", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => saveDraft("k", { a: 1 })).not.toThrow();
    vi.restoreAllMocks();
  });

  it("ignora un contenido corrupto", () => {
    sessionStorage.setItem("k", "{no es json");
    expect(takeDraft("k")).toBeNull();
  });
});
