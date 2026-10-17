import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("conserva un tamaño propio junto a un color de texto", () => {
    expect(cn("text-micro", "text-tinta-suave")).toBe("text-micro text-tinta-suave");
    expect(cn("px-4 font-bold uppercase text-tinta-suave", "text-cuerpo")).toContain("text-cuerpo");
  });

  it("un radio posterior reemplaza al anterior", () => {
    expect(cn("rounded-boton", "rounded-full")).toBe("rounded-full");
    expect(cn("rounded-campo", "rounded-tarjeta")).toBe("rounded-tarjeta");
  });

  it("un color posterior reemplaza al anterior", () => {
    expect(cn("text-tinta", "text-hoja")).toBe("text-hoja");
  });
});
