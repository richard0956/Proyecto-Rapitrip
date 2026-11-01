import { describe, expect, it } from "vitest";
import { generateStrongPassword, isStrongPassword, passwordChecks, passwordProblem, passwordStrength } from "./password";

describe("passwordChecks", () => {
  it("marca cada requisito por separado", () => {
    const ok = (password: string) => Object.fromEntries(passwordChecks(password).map((check) => [check.id, check.ok]));
    expect(ok("abc")).toEqual({ length: false, lower: true, upper: false, digit: false, symbol: false });
    expect(ok("Abcdef1!")).toEqual({ length: true, lower: true, upper: true, digit: true, symbol: true });
  });

  it("reconoce letras con tilde y la eñe como letras, no como símbolos", () => {
    const symbol = (password: string) => passwordChecks(password).find((check) => check.id === "symbol")?.ok;
    expect(symbol("Contraseña1")).toBe(false);
    expect(symbol("Contraseña1-")).toBe(true);
  });
});

describe("passwordProblem", () => {
  it("devuelve un mensaje si no cumple y nulo si cumple", () => {
    expect(passwordProblem("12345678")).toMatch(/mayúscula, minúscula, número y símbolo/);
    expect(passwordProblem("Abcdef1!")).toBeNull();
  });
});

describe("passwordStrength", () => {
  it("sube con los requisitos y premia el largo", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("abcdefgh").score).toBe(1);
    expect(passwordStrength("Abcdefgh").score).toBe(2);
    expect(passwordStrength("Abcdefg1").score).toBe(3);
    expect(passwordStrength("Abcdef1!").score).toBe(3);
    expect(passwordStrength("NuevaClave#2026").score).toBe(4);
  });
});

describe("generateStrongPassword", () => {
  it("siempre cumple todos los requisitos y evita caracteres ambiguos", () => {
    for (let i = 0; i < 200; i++) {
      const password = generateStrongPassword();
      expect(password).toHaveLength(16);
      expect(isStrongPassword(password)).toBe(true);
      expect(password).not.toMatch(/[lI1O0]/);
    }
  });

  it("respeta el largo pedido dentro de los límites y no repite", () => {
    expect(generateStrongPassword(24)).toHaveLength(24);
    expect(generateStrongPassword(4)).toHaveLength(12);
    expect(generateStrongPassword(500)).toHaveLength(72);
    expect(new Set(Array.from({ length: 50 }, () => generateStrongPassword())).size).toBe(50);
  });
});
