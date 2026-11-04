import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { CashWorkspace, type CatalogRow, type Sale, type Shift } from "./cash-workspace";

const shift: Shift = { id: "t1", openedAt: "2 nov 2026, 8:00", opening: 500, closed: false, difference: null, note: null, salesCount: 2, salesTotal: 400, cashExpected: 800 };
const catalog: CatalogRow[] = [
  { storeId: "s1", storeName: "Café Central", variantId: "v1", product: "Café molido", variant: "500 g", sku: "CAFE-500", price: 150, quantity: 5 },
  { storeId: "s2", storeName: "Farmacia San Rafael", variantId: "v2", product: "Suero oral", variant: "Sobre", sku: "P03-1", price: 25, quantity: null },
];
const sales: Sale[] = [
  { id: "a", number: 571, store: "Café Central", voided: false, method: "efectivo", total: 300, at: "8:10" },
  { id: "b", number: 572, store: "Farmacia San Rafael", voided: false, method: "tarjeta", total: 100, at: "8:20" },
  { id: "c", number: 573, store: "Café Central", voided: true, method: "efectivo", total: 150, at: "8:30" },
];
const actions = {
  openCashSession: vi.fn(),
  closeCashSession: vi.fn(),
  createCounterSale: vi.fn(),
  voidCounterSale: vi.fn(),
  receiveCourierCash: vi.fn(),
  returnCashToCustomer: vi.fn(),
  loadCashIncidents: vi.fn(),
};
const setup = () => render(<CashWorkspace shift={shift} history={[]} catalog={catalog} sales={sales} pendingCash={[]} pendingReturns={[]} actions={actions} />);
const saleRows = () => within(within(screen.getByRole("table", { name: "Ventas del turno" })).getAllByRole("rowgroup")[1]!).getAllByRole("row");

beforeEach(() => {
  vi.clearAllMocks();
  actions.createCounterSale.mockResolvedValue({ ok: true });
});

describe("CashWorkspace con el turno abierto", () => {
  it("resume el turno y la venta nueva queda cerrada hasta pedirla", () => {
    setup();
    expect(screen.getByText("Turno abierto")).toBeInTheDocument();
    expect(screen.getByText(/Efectivo esperado/).parentElement).toHaveTextContent("800");
    expect(screen.queryByRole("heading", { name: "Nueva venta" })).not.toBeInTheDocument();
  });

  it("vende eligiendo la tienda con el buscador", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getAllByRole("button", { name: "Nueva venta" })[0]!);
    await user.click(screen.getByRole("button", { name: /^Tienda:/ }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar tienda" }), "farma");
    expect(screen.queryByRole("option", { name: /Café Central/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Farmacia San Rafael/ }));
    await user.click(screen.getByRole("button", { name: "Agregar Suero oral, Sobre" }));
    await user.click(screen.getByRole("button", { name: "Cobrar" }));
    await waitFor(() => expect(actions.createCounterSale).toHaveBeenCalledWith({ store: "s2", method: "efectivo", reference: undefined, items: [{ variant_id: "v2", quantity: 1 }] }));
    expect(await screen.findByText(/Venta registrada por/)).toBeInTheDocument();
  });

  it("filtra las ventas del turno por tienda, forma de pago y estado", async () => {
    const user = userEvent.setup();
    setup();
    expect(saleRows()).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: /^Filtrar por tienda:/ }));
    await user.click(screen.getByRole("option", { name: "Café Central" }));
    expect(saleRows()).toHaveLength(2);
    await user.selectOptions(screen.getByLabelText("Estado de la venta"), "anuladas");
    expect(saleRows()).toHaveLength(1);
    expect(screen.getByText("Anulada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar" }));
    await user.selectOptions(screen.getByLabelText("Forma de pago"), "tarjeta");
    expect(saleRows()).toHaveLength(1);
    expect(screen.getByText("Venta 572")).toBeInTheDocument();
  });
});
