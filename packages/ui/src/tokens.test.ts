import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1]!, m[2]!]),
);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(tokens[a]!), luminance(tokens[b]!)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("tokens Ruta", () => {
  it("define los trece colores del informe", () => {
    expect(Object.keys(tokens).sort()).toEqual(
      ["selva", "hoja", "menta", "menta-borde", "crema", "papel", "borde", "borde-campo", "tinta", "tinta-suave", "mango", "guayaba", "calido"].sort(),
    );
  });

  // Pares de texto realmente usados por los componentes.
  it.each([
    ["tinta", "crema"],
    ["tinta", "papel"],
    ["tinta", "mango"],
    ["tinta", "calido"],
    ["tinta", "menta"],
    ["tinta-suave", "papel"],
    ["tinta-suave", "crema"],
    ["hoja", "papel"],
    ["hoja", "menta"],
    ["hoja", "crema"],
    ["selva", "menta"],
    ["crema", "selva"],
    ["menta-borde", "selva"],
  ])("%s sobre %s cumple 4.5:1", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("guayaba no se usa como texto: no llega a 4.5:1 sobre papel", () => {
    expect(contrast("guayaba", "papel")).toBeLessThan(4.5);
  });
});
