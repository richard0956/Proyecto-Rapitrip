import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("el detalle se abre en un modal con el título del pedido", async () => {
    await open(row({}));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Pedido 12" })).toBeInTheDocument();
    expect(within(dialog).getByText("Sillón · Gris")).toBeInTheDocument();
  });
});

describe("OrdersWorkspace · tabla y búsqueda", () => {
  const rows = [
    row({ id: "o1", number: 12, store: "Tienda A" }),
    row({ id: "o2", number: 40, store: "Tienda B", status: "entregado", deadline: null, items: [{ name: "Café molido · 500 g", quantity: 2, unitPrice: 150, total: 300 }], total: 300 }),
    row({ id: "o3", number: 41, store: "Tienda B", status: "en_camino", deadline: null, items: [{ name: "Té verde · Caja", quantity: 1, unitPrice: 80, total: 80 }], total: 80 }),
  ];
  const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("row");
  const setup = () => {
    render(<OrdersWorkspace rows={rows} setStatus={setStatus} loadDistance={loadDistance} />);
    return userEvent.setup();
  };

  it("lista en una tabla los pedidos de la pestaña activa", () => {
    setup();
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]!).getByText("Tienda A")).toBeInTheDocument();
  });

  it("la búsqueda encuentra pedidos de cualquier estado, por número, tienda o producto", async () => {
    const user = setup();
    const search = screen.getByRole("searchbox", { name: "Buscar pedido" });
    await user.type(search, "40");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Pedido 40/ })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "te verde");
    expect(screen.getByRole("button", { name: /Pedido 41/ })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "tienda b");
    expect(bodyRows()).toHaveLength(2);
  });

  it("sin coincidencias lo explica y permite limpiar la búsqueda", async () => {
    const user = setup();
    await user.type(screen.getByRole("searchbox", { name: "Buscar pedido" }), "zzzz");
    expect(screen.getByText("Ningún pedido coincide")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(bodyRows()).toHaveLength(1);
  });

  it("con varias tiendas se puede filtrar por tienda", async () => {
    const user = setup();
    await user.type(screen.getByRole("searchbox", { name: "Buscar pedido" }), "pedido");
    await user.clear(screen.getByRole("searchbox", { name: "Buscar pedido" }));
    await user.click(screen.getByRole("tab", { name: /Terminados/ }));
    await user.selectOptions(screen.getByLabelText("Tienda"), "Tienda B");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Pedido 40/ })).toBeInTheDocument();
  });
});
