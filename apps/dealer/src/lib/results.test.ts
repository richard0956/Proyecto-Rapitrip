import { describe, expect, it } from "vitest";
import { parseMoney } from "./money";
import { actionMessage, checkCash } from "./results";

describe("actionMessage", () => {
  it("ok no tiene mensaje", () => {
    expect(actionMessage("ok")).toBeNull();
  });
  it("explica cada resultado", () => {
    expect(actionMessage("incorrecto")).toMatch(/incorrecto/i);
    expect(actionMessage("bloqueado")).toMatch(/coordinación/);
    expect(actionMessage("falta_foto")).toMatch(/foto/);
    expect(actionMessage("sin_codigo")).toMatch(/coordinación/);
  });
  it("algo desconocido da un mensaje genérico", () => {
    expect(actionMessage("raro")).toMatch(/No pudimos/);
    expect(actionMessage(undefined)).toMatch(/No pudimos/);
  });
});

describe("checkCash", () => {
  it("el monto exacto no pide nota", () => {
    expect(checkCash("350", 350, "", parseMoney)).toEqual({ ok: true, amount: 350, differs: false });
    expect(checkCash("350,00", 350, "", parseMoney)).toEqual({ ok: true, amount: 350, differs: false });
  });
  it("un monto distinto exige explicar la diferencia", () => {
    expect(checkCash("300", 350, "", parseMoney)).toMatchObject({ ok: false, differs: true });
    expect(checkCash("300", 350, "ab", parseMoney)).toMatchObject({ ok: false, differs: true });
    expect(checkCash("300", 350, "El cliente solo tenía eso", parseMoney)).toEqual({ ok: true, amount: 300, differs: true });
  });
  it("un monto ilegible se rechaza", () => {
    expect(checkCash("abc", 350, "", parseMoney)).toMatchObject({ ok: false, differs: false });
    expect(checkCash("", 350, "", parseMoney)).toMatchObject({ ok: false, differs: false });
  });
  it("compara en centavos, sin errores de redondeo", () => {
    expect(checkCash("0.3", 0.1 + 0.2, "", parseMoney)).toMatchObject({ ok: true, differs: false });
  });
});
