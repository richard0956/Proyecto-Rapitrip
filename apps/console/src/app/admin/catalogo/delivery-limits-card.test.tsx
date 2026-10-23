import { defaultExpressLimits } from "@rapitrip/validation";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));

import { DeliveryLimitsCard } from "./delivery-limits-card";

const save = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  save.mockResolvedValue({ ok: true });
});

describe("DeliveryLimitsCard", () => {
  it("muestra los límites vigentes y guarda los nuevos", async () => {
    render(<DeliveryLimitsCard limits={defaultExpressLimits} save={save} />);
    expect(screen.getByLabelText("Peso por unidad (kg)")).toHaveValue(5);
    const user = userEvent.setup();
    const unit = screen.getByLabelText("Peso por unidad (kg)");
    await user.clear(unit);
    await user.type(unit, "6");
    await user.click(screen.getByRole("button", { name: "Guardar límites" }));
    expect(save).toHaveBeenCalledWith({ max_unit_kg: 6, max_side_cm: 45, max_sum_cm: 100, max_order_kg: 10 });
    expect(await screen.findByText("Límites guardados.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("no deja guardar límites incoherentes", async () => {
    render(<DeliveryLimitsCard limits={defaultExpressLimits} save={save} />);
    const user = userEvent.setup();
    const order = screen.getByLabelText("Peso por pedido express (kg)");
    await user.clear(order);
    await user.type(order, "3");
    expect(screen.getByText(/no puede ser menor que el de una unidad/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar límites" })).toBeDisabled();
  });

  it("muestra el error del servidor", async () => {
    save.mockResolvedValue({ ok: false, error: "acción reservada al administrador" });
    render(<DeliveryLimitsCard limits={defaultExpressLimits} save={save} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Guardar límites" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("acción reservada al administrador");
  });
});
