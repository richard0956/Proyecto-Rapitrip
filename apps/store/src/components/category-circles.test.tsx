import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseFilters } from "@/lib/catalog-filters";
import { CategoryCircles } from "./category-circles";

const c1 = "11111111-1111-4111-8111-111111111111";
const categories = [
  { id: c1, name: "Tecnología", product_count: 4 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Muebles", product_count: 2 },
];

describe("CategoryCircles", () => {
  it("marca la categoría elegida y cada círculo conserva el resto de filtros", () => {
    render(<CategoryCircles base="/catalogo" filters={parseFilters({ categoria: c1, descuento: "1" })} categories={categories} />);
    expect(screen.getByRole("link", { name: /Tecnología/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Muebles/ }).getAttribute("href")).toContain("descuento=1");
    expect(screen.getByRole("link", { name: /Todas/ })).toHaveAttribute("href", "/catalogo?descuento=1");
  });

  it("sin categorías no muestra la fila", () => {
    const { container } = render(<CategoryCircles base="/catalogo" filters={parseFilters({})} categories={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
