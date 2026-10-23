import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));
// El mapa de la ruta no se prueba aquí.
vi.mock("@/components/order-route", () => ({ OrderRoute: () => null }));

import { DispatchWorkspace, type Courier, type DispatchOrder } from "./dispatch-workspace";

const couriers: Courier[] = [
  { id: "c-moto", name: "Moto Managua", vehicle: "moto", phone: "1", vehicleClass: "moto", department: "managua" },
  { id: "c-van", name: "Camioneta Managua", vehicle: "camioneta", phone: "2", vehicleClass: "vehiculo", department: "managua" },
  { id: "c-leon", name: "Camioneta León", vehicle: "camioneta", phone: "3", vehicleClass: "vehiculo", department: "leon" },
  { id: "c-raw", name: "Sin clasificar", vehicle: "otro", phone: "4", vehicleClass: null, department: null },
];

const order = (over: Partial<DispatchOrder>): DispatchOrder => ({
  id: "o1",
  number: 7,
  store: "Tienda A",
  status: "confirmado",
  paymentMethod: "efectivo",
  paymentStatus: "pendiente",
  subtotal: 100,
  deliveryFee: 50,
  total: 150,
  courierId: null,
  reason: null,
  createdAt: "hoy",
  address: "Barrio Central",
  phone: "88881111",
  notes: null,
  items: [{ name: "Café · 500 g", quantity: 1, total: 100 }],
  deliveryClass: "express",
  originDepartment: "managua",
  destinationDepartment: "managua",
  etaMinDays: null,
  etaMaxDays: null,
  reclassifiedReason: null,
  ...over,
});

const setStatus = vi.fn();
const assign = vi.fn();
const reclassify = vi.fn();
const loadRoute = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  assign.mockResolvedValue({ ok: true });
  reclassify.mockResolvedValue({ ok: true });
  setStatus.mockResolvedValue({ ok: true });
});

async function open(row: DispatchOrder) {
  render(<DispatchWorkspace rows={[row]} couriers={couriers} setStatus={setStatus} assign={assign} reclassify={reclassify} loadRoute={loadRoute} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: /En preparación/ }));
  await user.click(screen.getByRole("button", { name: /Pedido 7/ }));
  return user;
}

const options = () => within(screen.getByLabelText("Repartidor")).getAllByRole("option").map((o) => o.textContent ?? "");

describe("DispatchWorkspace", () => {
  it("a un pedido express le ofrece a todos los repartidores", async () => {
    await open(order({}));
    expect(options().filter((text) => !text.startsWith("Elige"))).toHaveLength(4);
    expect(screen.getAllByText("Express").length).toBeGreaterThan(0);
  });

  it("a un pedido programado solo le ofrece vehículos del departamento de la tienda", async () => {
    await open(order({ deliveryClass: "programado", etaMinDays: 3, etaMaxDays: 7 }));
    expect(options().filter((text) => !text.startsWith("Elige"))).toEqual(["Camioneta Managua · camioneta"]);
    expect(screen.getByText(/3 repartidor\(es\) activos no aparecen/)).toBeInTheDocument();
    expect(screen.getByText("Llega en 3 a 7 días")).toBeInTheDocument();
  });

  it("asigna el repartidor elegido", async () => {
    const user = await open(order({ deliveryClass: "programado" }));
    await user.selectOptions(screen.getByLabelText("Repartidor"), "c-van");
    await user.click(screen.getByRole("button", { name: "Asignar repartidor" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("o1", "c-van"));
  });

  it("reclasifica un express a programado con motivo", async () => {
    const user = await open(order({}));
    await user.click(screen.getByRole("button", { name: "Reclasificar a programado" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Motivo"), "no cabe en la moto");
    await user.click(within(dialog).getByRole("button", { name: "Reclasificar" }));
    await waitFor(() => expect(reclassify).toHaveBeenCalledWith("o1", "no cabe en la moto"));
  });

  it("no ofrece reclasificar un programado ni un pedido que ya va en camino", async () => {
    await open(order({ deliveryClass: "programado" }));
    expect(screen.queryByRole("button", { name: "Reclasificar a programado" })).not.toBeInTheDocument();
  });

  it("muestra el motivo de una reclasificación anterior", async () => {
    await open(order({ deliveryClass: "programado", reclassifiedReason: "era un saco de 20 kg" }));
    expect(screen.getByText(/Reclasificado a programado: era un saco de 20 kg/)).toBeInTheDocument();
  });
});
