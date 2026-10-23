import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilterChips } from "./filter-chips";

const options = [
  { key: "hoy", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "mes", label: "Mes" },
];

describe("FilterChips", () => {
  it("marca el activo con aria-current", () => {
    render(<FilterChips basePath="/admin" param="periodo" current="mes" options={options} />);
    expect(screen.getByRole("link", { name: "Mes" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Hoy" })).not.toHaveAttribute("aria-current");
  });

  it("arma los enlaces conservando los otros filtros", () => {
    render(<FilterChips basePath="/admin" param="periodo" current="mes" options={options} keep={{ tienda: "abc", vacio: undefined }} />);
    expect(screen.getByRole("link", { name: "7 días" })).toHaveAttribute("href", "/admin?tienda=abc&periodo=7d");
  });

  it("muestra el conteo cuando se da", () => {
    render(<FilterChips basePath="/admin/solicitudes" param="estado" current="pendiente" options={[{ key: "pendiente", label: "Pendientes", count: 3 }]} />);
    expect(screen.getByRole("link", { name: "Pendientes · 3" })).toBeInTheDocument();
  });
});
