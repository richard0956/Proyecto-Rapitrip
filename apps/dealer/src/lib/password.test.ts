import { describe, expect, it } from "vitest";
import { passwordResult } from "./password";

describe("passwordResult", () => {
  it("sin error, la contraseña cambió", () => {
    expect(passwordResult(null)).toEqual({ ok: true });
  });

  it("si Supabase pide reautenticar, pide el código", () => {
    expect(passwordResult({ code: "reauthentication_needed" })).toMatchObject({ ok: false, needsCode: true });
    expect(passwordResult({ code: "reauthentication_not_valid" })).toMatchObject({ ok: false, needsCode: true, error: expect.stringMatching(/no es válido/) });
  });

  it("explica la contraseña repetida o débil", () => {
    expect(passwordResult({ code: "same_password" })).toMatchObject({ ok: false, error: expect.stringMatching(/distinta/) });
    expect(passwordResult({ code: "weak_password" })).toMatchObject({ ok: false, error: expect.stringMatching(/fácil de adivinar/) });
  });

  it("sin señal lo dice, y cualquier otro error es genérico", () => {
    expect(passwordResult({ message: "Failed to fetch" })).toMatchObject({ error: expect.stringMatching(/Sin conexión/) });
    expect(passwordResult({ code: "unexpected_failure", message: "x" })).toMatchObject({ ok: false, error: expect.stringMatching(/No pudimos/) });
  });
});
