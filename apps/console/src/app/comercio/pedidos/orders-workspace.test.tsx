import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));
vi.mock("@/components/order-route", () => ({ OrderDistance: () => null }));

import { OrdersWorkspace, type OrderRow } from "./orders-workspace";

const row = (over: Partial<OrderRow>): OrderRow => ({
  id: "o1",
  number: 12,
  store: "Tienda A",
  status: "por_confirmar",
  paymentMethod: "efectivo",
  paymentStatus: "pendiente",
  subtotal: 8000,
  deliveryFee: 120,
  total: 8120,
  itemCount: 1,
  reason: null,
  deadline: "mañana 10:00",
  deliveryClass: "express",
  etaMinDays: null,
  etaMaxDays: null,
  reclassifiedReason: null,
  createdAt: "hoy",
  items: [{ name: "Sillón · Gris", quantity: 1, unitPrice: 8000, total: 8000 }],
  ...over,
});

const setStatus = vi.fn();
const loadDistance = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  setStatus.mockResolvedValue({ ok: true });
});

async function open(r: OrderRow) {
  render(<OrdersWorkspace rows={[r]} setStatus={setStatus} loadDistance={loadDistance} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Pedido 12/ }));
  return user;
}

describe("OrdersWorkspace", () => {
  it("un pedido express se confirma directo", async () => {
    await open(row({}));
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Empezar a validar" })).not.toBeInTheDocument();
    expect(screen.getByText("Llega en pocas horas")).toBeInTheDocument();
  });

  it("un pedido programado puede empezar a validarse", async () => {
    const user = await open(row({ deliveryClass: "programado", etaMinDays: 3, etaMaxDays: 7 }));
    expect(screen.getByText("Llega en 3 a 7 días")).toBeInTheDocument();
    expect(screen.getByText(/lo lleva un repartidor con vehículo/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Empezar a validar" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("o1", { to: "en_validacion" }));
  });

  it("un pedido en validación se confirma o se rechaza, con su fecha límite", async () => {
    await open(row({ deliveryClass: "programado", status: "en_validacion", deadline: "viernes 18:00" }));
    expect(screen.getByRole("button", { name: "Confirmar (validado)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
    expect(screen.getByText(/Termina la validación antes de viernes 18:00/)).toBeInTheDocument();
  });

  it("avisa cuando coordinación pasó el pedido a programado", async () => {
    await open(row({ deliveryClass: "programado", reclassifiedReason: "pesaba 20 kg" }));
    expect(screen.getByText(/Coordinación lo pasó a programado: pesaba 20 kg/)).toBeInTheDocument();
  });
});
