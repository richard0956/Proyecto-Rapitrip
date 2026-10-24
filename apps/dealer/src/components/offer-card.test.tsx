import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CourierOffer } from "@/lib/types";
import { OfferCard } from "./offer-card";

function offer(over: Partial<CourierOffer> = {}): CourierOffer {
  return {
    offer_id: "f1", order_id: "o1", number: 1042, delivery_class: "express", store_name: "Café La Esquina", store_address: "Km 5 Carretera Norte",
    destination_department: "leon", distance_km: 3.4, courier_pay: 60, payment_method: "efectivo", cash_total: 350, item_count: 2,
    offered_at: new Date().toISOString(), expires_at: new Date(Date.now() + 120_000).toISOString(), ...over,
  };
}

function setup(over: Partial<CourierOffer> = {}, busy = false) {
  const onAccept = vi.fn();
  const onReject = vi.fn();
  render(<OfferCard offer={offer(over)} busy={busy} onAccept={onAccept} onReject={onReject} />);
  return { onAccept, onReject, user: userEvent.setup() };
}

describe("OfferCard", () => {
  it("muestra lo necesario para decidir y nada del cliente", () => {
    setup();
    expect(screen.getByText(/Pedido 1042/)).toBeInTheDocument();
    expect(screen.getByText("C$ 60.00")).toBeInTheDocument();
    expect(screen.getByText(/Cobras C\$ 350.00 en efectivo/)).toBeInTheDocument();
    expect(screen.getByText(/Entrega en León/)).toBeInTheDocument();
    expect(screen.getByText("Express")).toBeInTheDocument();
    expect(screen.getByLabelText(/Quedan [12]:\d\d/)).toBeInTheDocument();
  });

  it("no habla de efectivo si el pedido ya está pagado", () => {
    setup({ cash_total: null as unknown as number, payment_method: "tarjeta" });
    expect(screen.queryByText(/en efectivo/)).not.toBeInTheDocument();
  });

  it("aceptar llama una sola vez", async () => {
    const { user, onAccept } = setup();
    await user.click(screen.getByRole("button", { name: "Aceptar" }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("una propuesta vencida no se puede aceptar ni rechazar", () => {
    setup({ expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(screen.getAllByText("Venció").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeDisabled();
  });

  it("mientras responde, los botones se bloquean (no se toca dos veces)", () => {
    setup({}, true);
    expect(screen.getByRole("button", { name: /Un momento/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeDisabled();
  });

  it("rechazar pide un motivo y lo envía", async () => {
    const { user, onReject } = setup();
    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    await user.click(screen.getByRole("radio", { name: "Sin vehículo disponible" }));
    const buttons = screen.getAllByRole("button", { name: "Rechazar" });
    await user.click(buttons[buttons.length - 1]!);
    expect(onReject).toHaveBeenCalledWith("Sin vehículo disponible");
  });

  it("«Otro motivo» exige 5 caracteres o vacío", async () => {
    const { user, onReject } = setup();
    await user.click(screen.getByRole("button", { name: "Rechazar" }));
    await user.click(screen.getByRole("radio", { name: "Otro motivo" }));
    await user.type(screen.getByLabelText(/Cuéntanos/), "no");
    const confirm = () => screen.getAllByRole("button", { name: "Rechazar" }).at(-1)!;
    expect(confirm()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("al menos 5 caracteres");
    await user.clear(screen.getByLabelText(/Cuéntanos/));
    expect(confirm()).toBeEnabled();
    await user.click(confirm());
    expect(onReject).toHaveBeenCalledWith(null);
  });
});
