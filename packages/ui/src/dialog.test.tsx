import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

describe("Dialog", () => {
  it("tiene una «X» para cerrarlo que avisa al padre", async () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Pedido 12">contenido</Dialog>);
    expect(screen.getByRole("heading", { name: "Pedido 12" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar ventana" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no pinta el contenido mientras está cerrado", () => {
    render(<Dialog open={false} onClose={() => {}} title="Pedido 12">contenido</Dialog>);
    expect(screen.queryByText("contenido")).not.toBeInTheDocument();
  });
});
