import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@rapitrip/maps", () => ({ PinPicker: () => null }));

import { StoresWorkspace, type StoreRow } from "./stores-workspace";

const base: StoreRow = { id: "s1", name: "Tienda Central", address: "Centro", status: "activa", closed_until: null, open_now: true, hour_ranges: 7, located: true, metrics: { sales: 4500, orders: 9, topProducts: [{ name: "Café molido", units: 12 }, { name: "Té verde", units: 5 }] } };
const create = vi.fn();

describe("StoresWorkspace · métricas por tienda", () => {
  it("cada tienda muestra sus ventas, pedidos, ticket promedio y productos estrella", () => {
    render(<StoresWorkspace rows={[base]} create={create} periodLabel="este mes" />);
    const card = screen.getByRole("link", { name: /Tienda Central/ });
    expect(within(card).getByText(/9 pedidos/)).toBeInTheDocument();
    expect(within(card).getByText(/Ticket promedio/)).toBeInTheDocument();
    expect(within(card).getByText("Café molido")).toBeInTheDocument();
    expect(within(card).getByText("12 u.")).toBeInTheDocument();
  });

  it("sin ventas en el periodo lo dice en lugar de mostrar ceros engañosos", () => {
    render(<StoresWorkspace rows={[{ ...base, metrics: { sales: 0, orders: 0, topProducts: [] } }]} create={create} periodLabel="este mes" />);
    expect(screen.getByText("Sin ventas este mes")).toBeInTheDocument();
  });
});
