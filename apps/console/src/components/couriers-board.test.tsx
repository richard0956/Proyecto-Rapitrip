import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CourierStat } from "@/lib/couriers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { CouriersBoard } from "./couriers-board";

const base: CourierStat = { id: "1", name: "Carlos Núñez", phone: "8888-0001", vehicle: "Moto", status: "activo", since: "1 oct 2026", deliveries: 12, km: 40.5, avgMinutes: 35, activeOrders: 1, cashPending: 0, cashPendingOrders: 0 };
const rows: CourierStat[] = [
  base,
  { ...base, id: "2", name: "María López", phone: "8888-0002", vehicle: "Camioneta", deliveries: 20, km: 25, avgMinutes: 50, activeOrders: 0, cashPending: 400, cashPendingOrders: 2 },
  { ...base, id: "3", name: "Pedro Gómez", status: "inactivo", deliveries: 0, km: 0, avgMinutes: null, activeOrders: 0 },
];
const bodyRows = () => within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("row");
const create = vi.fn();

describe("CouriersBoard", () => {
  it("resume la flota con entregas, kilómetros y efectivo por rendir", () => {
    render(<CouriersBoard rows={rows} basePath="/admin/repartidores" periodLabel="este mes" />);
    const kpis = within(screen.getAllByRole("list")[0]!);
    expect(kpis.getByText("Entregas (este mes)")).toBeInTheDocument();
    expect(kpis.getByText("32")).toBeInTheDocument();
    expect(kpis.getByText("Efectivo por rendir")).toBeInTheDocument();
  });

  it("muestra a los mejores repartidores por entregas, kilómetros y rapidez", () => {
    render(<CouriersBoard rows={rows} basePath="/admin/repartidores" periodLabel="este mes" />);
    for (const title of ["Más entregas", "Más kilómetros", "Más rápidos"]) expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    const entregas = screen.getByRole("heading", { name: "Más entregas" }).closest("section")!;
    expect(within(entregas).getAllByRole("listitem")[0]).toHaveTextContent("María López");
  });

  it("cada repartidor lleva a su ficha y la búsqueda filtra sin acentos", async () => {
    const user = userEvent.setup();
    render(<CouriersBoard rows={rows} basePath="/coordinacion/repartidores" periodLabel="este mes" />);
    expect(screen.getAllByRole("link", { name: /Carlos Núñez/ })[0]).toHaveAttribute("href", "/coordinacion/repartidores/1");
    await user.type(screen.getByRole("searchbox", { name: "Buscar repartidor" }), "nunez");
    expect(bodyRows()).toHaveLength(1);
  });

  it("filtra por estado y sin coincidencias lo explica", async () => {
    const user = userEvent.setup();
    render(<CouriersBoard rows={rows} basePath="/admin/repartidores" periodLabel="este mes" />);
    await user.click(screen.getByRole("button", { name: "Inactivos · 1" }));
    expect(bodyRows()).toHaveLength(1);
    await user.type(screen.getByRole("searchbox", { name: "Buscar repartidor" }), "zzzz");
    expect(screen.getByText("Ningún repartidor coincide")).toBeInTheDocument();
  });

  it("solo el administrador ve «Nuevo repartidor»", () => {
    const { rerender } = render(<CouriersBoard rows={rows} basePath="/coordinacion/repartidores" periodLabel="este mes" />);
    expect(screen.queryByRole("button", { name: "Nuevo repartidor" })).not.toBeInTheDocument();
    rerender(<CouriersBoard rows={rows} basePath="/admin/repartidores" periodLabel="este mes" create={create} />);
    expect(screen.getByRole("button", { name: "Nuevo repartidor" })).toBeInTheDocument();
  });

  it("sin repartidores explica cómo se agregan", () => {
    render(<CouriersBoard rows={[]} basePath="/admin/repartidores" periodLabel="este mes" />);
    expect(screen.getByText("Todavía no hay repartidores")).toBeInTheDocument();
  });
});
