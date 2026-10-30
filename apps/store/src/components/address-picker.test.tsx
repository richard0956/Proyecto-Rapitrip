import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddressPicker } from "./address-picker";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));

const addresses = [
  { id: "a1", label: "Casa", address: "Del parque 2 c. al sur", is_default: true },
  { id: "a2", label: "Trabajo", address: "Edificio Central, piso 3", is_default: false },
];

describe("AddressPicker", () => {
  it("muestra la dirección predeterminada y permite elegir otra", async () => {
    const setDefault = vi.fn().mockResolvedValue({ ok: true, message: "" });
    render(<AddressPicker signedIn addresses={addresses} setDefault={setDefault} />);
    expect(screen.getByText("Entregar en · Casa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await userEvent.click(screen.getByRole("button", { name: /Trabajo/ }));
    expect(setDefault).toHaveBeenCalledWith("a2");
    expect(refresh).toHaveBeenCalled();
  });

  it("sin direcciones invita a agregar una", async () => {
    render(<AddressPicker signedIn addresses={[]} setDefault={vi.fn()} />);
    expect(screen.getByText("Agrega tu dirección")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("link", { name: /Agregar dirección/ })).toHaveAttribute("href", "/ajustes/direcciones");
  });

  it("sin sesión lleva a ingresar", async () => {
    render(<AddressPicker signedIn={false} addresses={[]} setDefault={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("link", { name: "Ingresar" }).getAttribute("href")).toContain("/ingresar?next=");
  });
});
