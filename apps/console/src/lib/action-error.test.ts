import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failure } from "./action-error";

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("failure", () => {
  it("muestra el mensaje de errores de negocio de la base de datos", () => {
    expect(failure({ code: "42501", message: "no tienes permiso para gestionar el rol admin" })).toEqual({ ok: false, error: "no tienes permiso para gestionar el rol admin" });
    expect(failure({ code: "22023", message: "el motivo es obligatorio (mínimo 5 caracteres)" })).toMatchObject({ ok: false, error: expect.stringContaining("motivo") });
  });

  it("oculta errores inesperados y los deja en el registro", () => {
    const result = failure({ code: "XX000", message: "relation identity.user_roles does not exist" });
    expect(result).toEqual({ ok: false, error: "No se pudo completar la acción. Inténtalo de nuevo." });
    expect(console.error).toHaveBeenCalled();
  });

  it("oculta errores sin código", () => {
    expect(failure(null)).toMatchObject({ ok: false, error: expect.not.stringContaining("relation") });
  });
});
