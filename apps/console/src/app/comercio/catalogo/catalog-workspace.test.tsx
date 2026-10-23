import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopProduct } from "@/lib/shop-catalog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { CatalogWorkspace } from "./catalog-workspace";

const base: ShopProduct = { id: "p1", storeId: "s1", name: "Café molido", status: "publicado", activeVariants: 1, minPrice: 150, cover: null, category: "Bebidas", categoryId: "c1", sold: 10, orders: 4, revenue: 1500, reserved: 3, cancelled: 1 };
const rows: ShopProduct[] = [
  base,
  { ...base, id: "p2", name: "Azúcar", status: "borrador", category: null, categoryId: null, sold: 0, orders: 0, revenue: 0, reserved: 0, cancelled: 0 },
  { ...base, id: "p3", name: "Té verde", categoryId: "c2", category: "Infusiones", sold: 25, orders: 9, revenue: 2000 },
  { ...base, id: "p4", name: "Panela", status: "archivado", sold: 0, orders: 0, revenue: 0, reserved: 0, cancelled: 0 },
  { ...base, id: "p5", storeId: "s2", name: "Producto de otra tienda" },
];
const stores = [{ id: "s1", name: "Tienda Central", active: true }, { id: "s2", name: "Tienda Norte", active: true }];
const categories = [{ id: "c1", name: "Bebidas" }, { id: "c2", name: "Infusiones" }];
const loadFlow = vi.fn();
const create = vi.fn();

function setup() {
  render(<CatalogWorkspace stores={stores} rows={rows} options={[]} categories={categories} selectedStore="s1" create={create} periodLabel="este mes" loadFlow={loadFlow} />);
  return userEvent.setup();
}
const cards = () => screen.getAllByRole("listitem").filter((item) => within(item).queryByRole("link") !== null);

beforeEach(() => {
  vi.clearAllMocks();
  loadFlow.mockResolvedValue({ ok: true, labels: ["01", "02", "03"], units: [2, 0, 8], orders: [1, 0, 3] });
});

describe("CatalogWorkspace · filtros y métricas", () => {
  it("muestra las cifras de la tienda: más vendido, unidades y apartadas", () => {
    setup();
    expect(screen.getByText("Más vendido (este mes)")).toBeInTheDocument();
    expect(screen.getAllByText("Té verde").length).toBeGreaterThan(0);
    expect(screen.getByText("Unidades apartadas")).toBeInTheDocument();
  });

  it("cada producto muestra lo que vendió y en cuántos pedidos estuvo", () => {
    setup();
    const card = screen.getByRole("link", { name: /Café molido/ });
    expect(within(card).getByText(/10 vendidas/)).toBeInTheDocument();
    expect(within(card).getByText(/4 pedidos/)).toBeInTheDocument();
  });

  it("por defecto oculta los archivados y los filtros de estado los traen", async () => {
    const user = setup();
    expect(screen.queryByText("Panela")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archivados · 1" }));
    expect(screen.getByText("Panela")).toBeInTheDocument();
    expect(screen.queryByText("Té verde", { selector: "a *" })).not.toBeInTheDocument();
  });

  it("filtra por categoría, por sin ventas y busca por nombre", async () => {
    const user = setup();
    await user.selectOptions(screen.getByLabelText("Categoría"), "c2");
    expect(cards()).toHaveLength(1);
    await user.selectOptions(screen.getByLabelText("Categoría"), "");
    await user.click(screen.getByRole("button", { name: "Sin ventas · 1" }));
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Azúcar/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sin ventas · 1" }));
    await user.type(screen.getByRole("searchbox", { name: "Buscar producto" }), "cafe");
    expect(cards()).toHaveLength(1);
  });

  it("ordena por más vendidos", async () => {
    const user = setup();
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "vendidos");
    expect(within(cards()[0]!).getByText("Té verde")).toBeInTheDocument();
  });

  it("el flujo de un producto abre un modal con su gráfico y sus cantidades", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Ver flujo de Café molido" }));
    await waitFor(() => expect(loadFlow).toHaveBeenCalledWith("p1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Flujo de Café molido" })).toBeInTheDocument();
    expect(await within(dialog).findByRole("img", { name: /Unidades vendidas por día/ })).toBeInTheDocument();
    expect(within(dialog).getByText("Vendidas")).toBeInTheDocument();
    expect(within(dialog).getByText("Apartadas")).toBeInTheDocument();
    expect(within(dialog).getByText("Canceladas")).toBeInTheDocument();
  });
});
