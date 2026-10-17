import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("usa type=button por defecto", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("type", "button");
  });

  it("la variante primaria es verde hoja", () => {
    render(<Button>Pagar</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-hoja");
  });

  it("la variante de peligro usa el rosa suave", () => {
    render(<Button variant="danger">Revocar</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-rosa");
  });
});
