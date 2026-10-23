import { describe, expect, it } from "vitest";
import { friendlyError, isAuthError } from "./api-error";

describe("friendlyError", () => {
  it("un fallo de red se explica como falta de señal", () => {
    expect(friendlyError({ message: "Failed to fetch" })).toMatch(/Sin conexión/);
  });
  it("muestra los mensajes de la base de datos para errores de uso", () => {
    expect(friendlyError({ code: "22023", message: "el pedido aún no está listo para recoger" })).toBe("el pedido aún no está listo para recoger");
    expect(friendlyError({ code: "23505", message: "ya hay una evidencia" })).toBe("ya hay una evidencia");
    expect(friendlyError({ code: "P0002", message: "pedido no encontrado" })).toBe("pedido no encontrado");
  });
  it("un error de permiso pide ingresar de nuevo", () => {
    expect(friendlyError({ code: "42501", message: "solo un repartidor…" })).toMatch(/Ingresa de nuevo/);
  });
  it("lo inesperado no filtra detalles internos", () => {
    expect(friendlyError({ code: "XX000", message: "relation sales.orders does not exist" })).toBe("No pudimos completar la acción. Inténtalo de nuevo.");
    expect(friendlyError(null, "Algo falló")).toBe("Algo falló");
  });
});

describe("isAuthError", () => {
  it("reconoce la sesión terminada", () => {
    expect(isAuthError({ code: "42501" })).toBe(true);
    expect(isAuthError({ code: "28000" })).toBe(true);
    expect(isAuthError({ code: "22023" })).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});
