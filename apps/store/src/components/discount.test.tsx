import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CatalogProduct } from "@/lib/catalog";
import { DiscountBadge, PriceWas } from "./discount";
import { ProductCard } from "./product-card";

const product = (over: Partial<CatalogProduct>): CatalogProduct => ({
  id: "p1",
  store_id: "s1",
  store_name: "Tienda A",
  name: "Café",
  category_id: null,
  category_name: null,
  min_price: 80,
  cover_path: null,
  variant_count: 1,
  quick_variant_id: "v1",
  quick_variant_name: "500 g",
  quick_max: null,
  commerce_kind: "informal",
  store_open: true,
  created_at: "2026-10-22T10:00:00Z",
  brand_name: null,
  total_count: 1,
  compare_price: null,
  discount_pct: 0,
  sold_units: 0,
  ...over,
});

describe("DiscountBadge / PriceWas", () => {
  it("muestra el porcentaje y lo anuncia completo a lectores de pantalla", () => {
    render(<DiscountBadge pct={20} />);
    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.getByText("Descuento del 20 por ciento")).toBeInTheDocument();
  });

  it("no muestra nada sin descuento", () => {
    const { container } = render(<><DiscountBadge pct={0} /><PriceWas value={null} /></>);
    expect(container).toBeEmptyDOMElement();
  });

  it("tacha el precio anterior", () => {
    render(<PriceWas value={100} />);
    expect(screen.getByText(/100/).closest("span")).toHaveClass("line-through");
    expect(screen.getByText("Antes")).toBeInTheDocument();
  });
});

describe("ProductCard con descuento", () => {
  it("muestra la insignia y el precio anterior tachado", () => {
    render(<ul><ProductCard product={product({ discount_pct: 20, compare_price: 100 })} /></ul>);
    expect(screen.getByText("-20%")).toBeInTheDocument();
    expect(screen.getByText(/100/).closest("span")).toHaveClass("line-through");
  });

  it("si solo otra presentación está en descuento, muestra la insignia sin tachar el precio", () => {
    render(<ul><ProductCard product={product({ variant_count: 2, discount_pct: 25, compare_price: null })} /></ul>);
    expect(screen.getByText("-25%")).toBeInTheDocument();
    expect(screen.queryByText("Antes")).not.toBeInTheDocument();
  });

  it("sin descuento no hay insignia", () => {
    render(<ul><ProductCard product={product({})} /></ul>);
    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
  });
});
