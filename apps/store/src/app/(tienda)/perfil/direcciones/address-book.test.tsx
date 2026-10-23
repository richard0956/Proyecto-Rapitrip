import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }));

import { AddressBook } from "./address-book";

const save = vi.fn();
const actions = { save, setDefault: vi.fn(), remove: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  save.mockResolvedValue({ ok: true, message: "Dirección guardada." });
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 12.1364, longitude: -86.2514 } }) }, configurable: true });
});

async function openForm() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Agregar dirección" }));
  await user.type(screen.getByLabelText("Nombre"), "Casa");
  await user.type(screen.getByLabelText("Dirección de entrega"), "Barrio Central, casa 4");
  await user.click(await screen.findByRole("button", { name: "Usar mi ubicación" }));
  return user;
}

describe("AddressBook", () => {
  it("muestra el departamento de una dirección guardada", () => {
    render(<AddressBook addresses={[{ id: "a1", label: "Casa", address: "Barrio Central", reference: null, phone: null, is_default: true, department: "leon" }]} actions={actions} />);
    expect(screen.getByText("Departamento: León")).toBeInTheDocument();
  });

  it("ya no pide el departamento: se deduce del punto del mapa", async () => {
    render(<AddressBook addresses={[]} actions={actions} />);
    await openForm();
    expect(screen.queryByLabelText("Departamento")).not.toBeInTheDocument();
  });

  it("guarda la dirección con su punto, sin departamento escrito por el cliente", async () => {
    render(<AddressBook addresses={[]} actions={actions} />);
    const user = await openForm();
    await user.click(screen.getByRole("button", { name: "Guardar dirección" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]![0]).toMatchObject({ label: "Casa", address: "Barrio Central, casa 4", latitude: 12.1364, longitude: -86.2514 });
    expect(save.mock.calls[0]![0]).not.toHaveProperty("department");
  });
});
