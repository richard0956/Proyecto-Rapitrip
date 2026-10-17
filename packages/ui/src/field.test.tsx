import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";

describe("Field", () => {
  it("asocia la etiqueta con el campo", () => {
    render(<Field label="Correo" />);
    expect(screen.getByLabelText("Correo")).toBeInTheDocument();
  });

  it("anuncia el error y marca el campo como inválido", () => {
    render(<Field label="Correo" error="correo inválido" />);
    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("correo inválido");
  });
});
