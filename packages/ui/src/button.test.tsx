import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("usa type=button por defecto", () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("type", "button");
  });

  it("aplica la variante primaria con Mango", () => {
    render(<Button variant="primary">Pagar</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-mango");
  });
});
