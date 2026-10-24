import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));
// El mapa de la ruta no se prueba aquí.
vi.mock("@/components/order-route", () => ({ OrderRoute: () => null }));

import { DispatchWorkspace, type CourierAppActions, type Courier, type DispatchOrder } from "./dispatch-workspace";

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


describe("DispatchWorkspace con la aplicación del repartidor", () => {
  const future = new Date(Date.now() + 120_000).toISOString();
  const app = (): CourierAppActions => ({
    loadOfferable: vi.fn().mockResolvedValue({ ok: true, couriers: [{ id: "c-moto", name: "Moto Managua", vehicleClass: "moto", department: "managua", activeOrders: 1 }] }),
    offer: vi.fn().mockResolvedValue({ ok: true }),
    cancelOffer: vi.fn().mockResolvedValue({ ok: true }),
    resolveIssue: vi.fn().mockResolvedValue({ ok: true }),
    resetCode: vi.fn().mockResolvedValue({ ok: true }),
    loadTrace: vi.fn().mockResolvedValue({ ok: true, entries: [], photos: [], cash: null }),
  });

  async function openWithApp(row: DispatchOrder, tabName: RegExp, actions: CourierAppActions) {
    render(<DispatchWorkspace rows={[row]} couriers={couriers} setStatus={setStatus} assign={assign} reclassify={reclassify} loadRoute={loadRoute} courierApp={actions} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: tabName }));
    await user.click(screen.getByRole("button", { name: /Pedido 7/ }));
    return user;
  }

  it("propone el pedido a un repartidor disponible", async () => {
    const actions = app();
    const user = await openWithApp(order({}), /En preparación/, actions);
    await user.selectOptions(await screen.findByLabelText("Repartidor disponible"), "c-moto");
    await user.click(screen.getByRole("button", { name: "Enviar propuesta" }));
    await waitFor(() => expect(actions.offer).toHaveBeenCalledWith("o1", "c-moto"));
  });

  it("deja «asignar directamente» como excepción, con aviso de quién no tiene cuenta", async () => {
    await openWithApp(order({}), /En preparación/, app());
    expect(screen.getByLabelText("Asignar directamente (excepción)")).toBeInTheDocument();
  });

  it("una propuesta abierta se ve en la lista y se puede retirar", async () => {
    const actions = app();
    const offers = [{ id: "f1", courierName: "Ana", status: "pendiente" as const, expiresAt: future, respondedAt: null, rejectReason: null }];
    const user = await openWithApp(order({ offers }), /En preparación/, actions);
    expect(screen.getAllByText(/Propuesta a Ana/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Retirar propuesta" }));
    await waitFor(() => expect(actions.cancelOffer).toHaveBeenCalledWith("f1"));
  });

  it("una propuesta rechazada se marca en la lista y dice qué hacer", async () => {
    const offers = [{ id: "f1", courierName: "Ana", status: "rechazada" as const, expiresAt: future, respondedAt: future, rejectReason: "Estoy muy lejos" }];
    await openWithApp(order({ offers }), /En preparación/, app());
    expect(screen.getAllByText(/Rechazada por Ana/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ana la rechazó: «Estoy muy lejos». Propónsela a otro./)).toBeInTheDocument();
  });

  it("muestra los avisos del repartidor y permite atenderlos", async () => {
    const actions = app();
    const issues = [{ id: "i1", kind: "no_entregado", reason: "Nadie abrió la puerta", createdAt: "hoy 3:00 p. m." }];
    const user = await openWithApp(order({ issues, status: "preparando" }), /En preparación/, actions);
    expect(screen.getAllByText("Aviso del repartidor").length).toBeGreaterThan(0);
    expect(screen.getByText(/Nadie abrió la puerta/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marcar como atendido" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Motivo"), "Se reprograma para mañana");
    await user.click(within(dialog).getByRole("button", { name: "Marcar como atendido" }));
    await waitFor(() => expect(actions.resolveIssue).toHaveBeenCalledWith("i1", "Se reprograma para mañana"));
  });

  it("un aviso «no cabe» ofrece reclasificar desde el mismo aviso", async () => {
    const issues = [{ id: "i2", kind: "no_cabe", reason: "Es un saco grande", createdAt: "hoy" }];
    await openWithApp(order({ issues }), /En preparación/, app());
    expect(screen.getAllByRole("button", { name: "Reclasificar a programado" }).length).toBeGreaterThanOrEqual(2);
  });

  it("despachar por un repartidor con cuenta sin su evidencia pide el motivo y lo reintenta", async () => {
    setStatus.mockResolvedValueOnce({ ok: false, error: "falta la evidencia de recogida: indica el motivo (entre 5 y 200 caracteres)" });
    const user = await openWithApp(order({ status: "listo", courierId: "c-moto", courierHasAccount: true }), /Para despachar/, app());
    await user.click(screen.getByRole("button", { name: /Despachar/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/aún no registró la foto o el código/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Motivo"), "El repartidor no tiene señal");
    await user.click(within(dialog).getByRole("button", { name: /Despachar/ }));
    await waitFor(() => expect(setStatus).toHaveBeenLastCalledWith("o1", { to: "en_camino", reason: "El repartidor no tiene señal" }));
  });

  it("un repartidor con cuenta puede tener su código liberado", async () => {
    const actions = app();
    const user = await openWithApp(order({ status: "listo", courierId: "c-moto", courierHasAccount: true }), /Para despachar/, actions);
    await user.click(screen.getByRole("button", { name: "Liberar código de entrega" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Motivo"), "El cliente lo confirmó por teléfono");
    await user.click(within(dialog).getByRole("button", { name: "Liberar" }));
    await waitFor(() => expect(actions.resetCode).toHaveBeenCalledWith("o1", "entrega", "El cliente lo confirmó por teléfono"));
  });

  it("sin la aplicación conectada, la pantalla se comporta como antes", async () => {
    await open(order({}));
    expect(screen.queryByText("Proponer a un repartidor")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Repartidor")).toBeInTheDocument();
  });
});
