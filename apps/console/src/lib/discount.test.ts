import { describe, expect, it } from "vitest";
import { discountAfterChange, discountPercent } from "./discount";

describe("discountPercent", () => {
  it("calcula el porcentaje entre el precio de lista y el actual", () => {
    expect(discountPercent(80, 100)).toBe(20);
    expect(discountPercent(70, 80)).toBe(13);
    expect(discountPercent(100, null)).toBe(0);
    expect(discountPercent(100, 90)).toBe(0);
  });
});

describe("discountAfterChange", () => {
  it("una baja de menos de 5 % no es descuento", () => {
    expect(discountAfterChange({ price: 100, compareAt: null }, 96)).toEqual({ compareAt: null, pct: 0 });
  });

  it("una baja de 5 % o más activa el descuento con el precio anterior", () => {
    expect(discountAfterChange({ price: 100, compareAt: null }, 95)).toEqual({ compareAt: 100, pct: 5 });
    expect(discountAfterChange({ price: 100, compareAt: null }, 80)).toEqual({ compareAt: 100, pct: 20 });
  });

  it("con un descuento vigente, la referencia sigue siendo el precio de lista", () => {
    expect(discountAfterChange({ price: 80, compareAt: 100 }, 70)).toEqual({ compareAt: 100, pct: 30 });
    expect(discountAfterChange({ price: 80, compareAt: 100 }, 90)).toEqual({ compareAt: 100, pct: 10 });
    expect(discountAfterChange({ price: 80, compareAt: 100 }, 96)).toEqual({ compareAt: null, pct: 0 });
  });

  it("subir el precio por encima de la lista quita el descuento y la lista nueva es el precio de entonces", () => {
    expect(discountAfterChange({ price: 80, compareAt: 100 }, 120)).toEqual({ compareAt: null, pct: 0 });
    expect(discountAfterChange({ price: 120, compareAt: null }, 80)).toEqual({ compareAt: 120, pct: 33 });
  });

  it("no se equivoca con centavos", () => {
    expect(discountAfterChange({ price: 33.33, compareAt: null }, 31.66)).toEqual({ compareAt: 33.33, pct: 5 });
    expect(discountAfterChange({ price: 33.33, compareAt: null }, 31.67)).toEqual({ compareAt: null, pct: 0 });
  });
});
