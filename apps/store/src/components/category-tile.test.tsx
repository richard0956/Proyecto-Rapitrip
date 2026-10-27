import { render, screen } from "@testing-library/react";
import { Armchair, Laptop, Tag, Wrench } from "lucide-react";
import { describe, expect, it } from "vitest";
import { categoryIcon, CategoryTile } from "./category-tile";

describe("CategoryTile", () => {
  it("elige el ícono por palabras del nombre y cae en la etiqueta si no reconoce ninguna", () => {
    expect(categoryIcon("Tecnología")).toBe(Laptop);
    expect(categoryIcon("Muebles y sillas")).toBe(Armchair);
    expect(categoryIcon("Herramientas")).toBe(Wrench);
    expect(categoryIcon("Varios")).toBe(Tag);
  });

  it("enlaza al catálogo filtrado y muestra cuántos productos tiene", () => {
    render(<ul><CategoryTile category={{ id: "c1", name: "Ferretería", product_count: 1 }} index={0} /></ul>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/catalogo?categoria=c1");
    expect(screen.getByText("1 producto")).toBeInTheDocument();
  });
});
