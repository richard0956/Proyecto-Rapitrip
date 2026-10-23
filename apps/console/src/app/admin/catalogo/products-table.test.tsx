import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductRow } from "@/lib/catalog-products";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ProductsTable } from "./products-table";

const base: ProductRow = { id: "1", name: "Café molido", description: "Tostado medio", storeId: "s1", storeName: "Tienda Central", commerceName: "Cafetales SA", categoryId: "c1", brandId: null, typeId: null, status: "publicado", minPrice: 150, activeVariants: 1, sold: 8, revenue: 1200, reorder: 0, outOfStock: 0 };
const rows: ProductRow[] = [
  base,
  { ...base, id: "2", name: "Té verde", storeId: "s2", storeName: "Tienda Norte", commerceName: "Hierbas Núñez", categoryId: "c2", status: "borrador", sold: 0, revenue: 0, reorder: 1 },
  { ...base, id: "3", name: "Azúcar", categoryId: null, status: "archivado", reorder: 2, outOfStock: 1 },
];
const options = { categories: [{ id: "c1", name: "Bebidas" }, { id: "c2", name: "Infusiones" }], brands: [{ id: "b1", name: "Marca Uno" }], types: [{ id: "t1", name: "Granel" }] };
const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("row");

beforeEach(() => vi.clearAllMocks());

function setup() {
  const update = vi.fn().mockResolvedValue({ ok: true });
  const setStatus = vi.fn().mockResolvedValue({ ok: true });
  render(<ProductsTable rows={rows} {...options} periodLabel="este mes" update={update} setStatus={setStatus} />);
  return { update, setStatus, user: userEvent.setup() };
}

describe("ProductsTable", () => {
  it("lista los productos de todos los comercios y cuántos hay", () => {
    setup();
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("3 de 3 productos");
  });

  it("busca por producto, tienda o comercio mientras se escribe", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Buscar producto" }), "nunez");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Té verde")).toBeInTheDocument();
  });

  it("filtra por estado, categoría y reorden", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Borradores · 1" }));
    expect(bodyRows()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Todos · 3" }));
    await user.selectOptions(screen.getByLabelText("Categoría"), "none");
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("Azúcar")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Categoría"), "");
    await user.click(screen.getByRole("button", { name: "En reorden · 2" }));
    expect(bodyRows()).toHaveLength(2);
  });

  it("sin coincidencias lo explica y permite limpiar", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Buscar producto" }), "zzzz");
    expect(screen.getByText("Ningún producto coincide")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(bodyRows()).toHaveLength(3);
  });

  it("edita nombre, descripción y clasificación y refresca la pantalla", async () => {
    const { user, update } = setup();
    await user.click(screen.getByRole("button", { name: "Editar Café molido" }));
    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Café de altura");
    await user.selectOptions(screen.getByLabelText("Marca"), "b1");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("1", { name: "Café de altura", description: "Tostado medio", category_id: "c1", brand_id: "b1", product_type_id: null }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("ocultar y archivar exigen un motivo de al menos 5 caracteres", async () => {
    const { user, setStatus } = setup();
    await user.click(screen.getByRole("button", { name: "Editar Café molido" }));
    const hide = screen.getByRole("button", { name: "Ocultar producto" });
    expect(hide).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo"), "foto engañosa");
    expect(hide).toBeEnabled();
    await user.click(hide);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("1", { status: "borrador", reason: "foto engañosa" }));
  });

  it("un producto archivado no se edita", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Ver Azúcar" }));
    expect(screen.getByText("Un producto archivado no se edita.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
  });
});
