import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("sobre fondo claro usa el logo completo con su nombre accesible", () => {
    render(<Logo tone="light" />);
    const img = screen.getByRole("img", { name: "Rapitrip" });
    expect(img).toHaveAttribute("src", "/brand/logo-completo.webp");
  });

  it("sobre fondo oscuro usa el nombre en texto blanco y el emblema decorativo en baldosa clara", () => {
    const { container } = render(<Logo tone="dark" subtitle="Consola de operación" />);
    expect(screen.getByText("Rapitrip")).toHaveClass("text-white");
    expect(screen.queryByRole("img", { name: "Rapitrip" })).toBeNull();
    const emblem = container.querySelector('img[src="/brand/emblema-192.webp"]');
    expect(emblem).toHaveAttribute("alt", "");
    expect(emblem?.parentElement).toHaveClass("bg-papel");
  });

  it("el subtítulo sobre fondo oscuro usa un color con contraste suficiente", () => {
    render(<Logo tone="dark" subtitle="Consola de operación" />);
    expect(screen.getByText("Consola de operación")).toHaveClass("text-bruma");
  });

  it("declara dimensiones para evitar saltos de maquetación", () => {
    render(<Logo tone="light" />);
    expect(screen.getByRole("img", { name: "Rapitrip" })).toHaveAttribute("width");
    expect(screen.getByRole("img", { name: "Rapitrip" })).toHaveAttribute("height");
  });
});
