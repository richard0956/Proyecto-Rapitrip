import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import type { OfferInfo } from "@/lib/offers";
import { OfferPanel } from "./offer-panel";

const future = () => new Date(Date.now() + 150_000).toISOString();
const offerInfo = (over: Partial<OfferInfo> = {}): OfferInfo => ({ id: "f1", courierName: "Ana", status: "pendiente", expiresAt: future(), respondedAt: null, rejectReason: null, ...over });

function setup(over: Partial<Parameters<typeof OfferPanel>[0]> = {}) {
  const props = {
    orderId: "o1",
    canOffer: true,
    offers: [] as OfferInfo[],
    loadOfferable: vi.fn().mockResolvedValue({ ok: true, couriers: [{ id: "c1", name: "Ana", vehicleClass: "moto", department: "managua", activeOrders: 0 }, { id: "c2", name: "Beto", vehicleClass: "moto", department: "managua", activeOrders: 2 }] }),
    offer: vi.fn().mockResolvedValue({ ok: true }),
    cancel: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  };
  render(<OfferPanel {...props} />);
  return { ...props, user: userEvent.setup() };
}

beforeEach(() => vi.clearAllMocks());

describe("OfferPanel", () => {
  it("lista a quienes pueden recibir la propuesta, con su carga, y la envía", async () => {
    const { user, offer } = setup();
    const select = await screen.findByLabelText("Repartidor disponible");
    expect(screen.getByRole("option", { name: "Beto · 2 pedidos en curso" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ana · 0 pedidos en curso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar propuesta" })).toBeDisabled();
    await user.selectOptions(select, "c2");
    await user.click(screen.getByRole("button", { name: "Enviar propuesta" }));
    await waitFor(() => expect(offer).toHaveBeenCalledWith("o1", "c2"));
    expect(await screen.findByText(/El repartidor tiene 3 minutos/)).toBeInTheDocument();
  });

  it("si nadie puede recibirla, lo explica y recuerda la asignación directa", async () => {
    setup({ loadOfferable: vi.fn().mockResolvedValue({ ok: true, couriers: [] }) });
    expect(await screen.findByText(/Ningún repartidor puede recibir una propuesta ahora/)).toBeInTheDocument();
    expect(screen.getByText(/asignarlo directamente/)).toBeInTheDocument();
  });

  it("con una propuesta abierta muestra la espera con su cuenta regresiva y deja retirarla", async () => {
    const { user, cancel, loadOfferable } = setup({ offers: [offerInfo()] });
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText(/^[12]:\d\d$/)).toBeInTheDocument();
    expect(loadOfferable).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retirar propuesta" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith("f1"));
  });

  it("muestra cómo terminó la última propuesta y vuelve a ofrecer repartidores", async () => {
    setup({ offers: [offerInfo({ status: "rechazada", rejectReason: "Estoy muy lejos" })] });
    expect(await screen.findByText(/Ana la rechazó: «Estoy muy lejos»/)).toBeInTheDocument();
    expect(await screen.findByLabelText("Repartidor disponible")).toBeInTheDocument();
  });

  it("si la base de datos rechaza la propuesta, muestra el motivo", async () => {
    const { user } = setup({ offer: vi.fn().mockResolvedValue({ ok: false, error: "el repartidor no está disponible ahora" }) });
    await user.selectOptions(await screen.findByLabelText("Repartidor disponible"), "c1");
    await user.click(screen.getByRole("button", { name: "Enviar propuesta" }));
    expect(await screen.findByText("el repartidor no está disponible ahora")).toBeInTheDocument();
  });

  it("un pedido que no admite propuesta no muestra el panel", () => {
    const { loadOfferable } = setup({ canOffer: false });
    expect(screen.queryByText("Proponer a un repartidor")).not.toBeInTheDocument();
    expect(loadOfferable).not.toHaveBeenCalled();
  });
});
