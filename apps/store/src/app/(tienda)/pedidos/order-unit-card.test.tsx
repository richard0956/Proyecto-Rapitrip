import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildUnits, type ListedOrder, type UnitRow } from "@/lib/purchases";
import { OrderUnitCard } from "./order-unit-card";

const CO = "c0000000-0000-4000-8000-000000000001";
const order = (over: Partial<ListedOrder>): ListedOrder => ({
  id: "o1",
  number: 1,
  checkout_id: null,
  store_name: "Tienda A",
  status: "por_confirmar",
  total: 100,
  item_count: 2,
  created_at: "2026-10-22T10:00:00Z",
  delivery_class: "express",
  eta_min_days: null,
  eta_max_days: null,
  ...over,
});
const unit = (over: Partial<UnitRow>): UnitRow => ({ unit_id: "o1", checkout_id: null, created_at: "2026-10-22T10:00:00Z", order_count: 1, total: 100, payment_status: null, ...over });

function renderUnit(units: UnitRow[], orders: ListedOrder[]) {
  const [first] = buildUnits(units, orders);
  render(<ul><OrderUnitCard unit={first!} /></ul>);
}

describe("OrderUnitCard", () => {
  it("un pedido suelto se ve como una tarjeta con su clase y su plazo", () => {
    renderUnit([unit({})], [order({})]);
    expect(screen.getByRole("link", { name: "Pedido 1 · Tienda A" })).toHaveAttribute("href", "/pedidos/o1");
    expect(screen.getByText("Express")).toBeInTheDocument();
    expect(screen.getByText("Llega en pocas horas")).toBeInTheDocument();
    expect(screen.getByText(/2 productos/)).toBeInTheDocument();
    expect(screen.getByText("Por confirmar")).toBeInTheDocument();
  });

  it("una compra de un solo pedido también se ve como un pedido normal", () => {
    renderUnit([unit({ unit_id: CO, checkout_id: CO })], [order({ checkout_id: CO })]);
    expect(screen.getByRole("link", { name: "Pedido 1 · Tienda A" })).toBeInTheDocument();
    expect(screen.queryByText(/Compra de/)).not.toBeInTheDocument();
  });

  it("una compra con varios pedidos se muestra como grupo, con el total y cada entrega", () => {
    renderUnit(
      [unit({ unit_id: CO, checkout_id: CO, order_count: 2, total: 420 })],
      [
        order({ id: "o2", number: 2, checkout_id: CO, store_name: "Tienda A", total: 350 }),
        order({ id: "o3", number: 3, checkout_id: CO, store_name: "Tienda B", total: 70, delivery_class: "programado", eta_min_days: 3, eta_max_days: 7, status: "en_validacion" }),
      ],
    );
    expect(screen.getByRole("link", { name: "Compra de 2 pedidos" })).toHaveAttribute("href", `/compras/${CO}`);
    expect(screen.getAllByRole("link", { name: /^Pedido \d/ })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Pedido 3 · Tienda B" })).toHaveAttribute("href", "/pedidos/o3");
    expect(screen.getByText("Programado")).toBeInTheDocument();
    expect(screen.getByText("Llega en 3 a 7 días")).toBeInTheDocument();
    expect(screen.getByText("En validación")).toBeInTheDocument();
    expect(screen.getByText(/2 siguen abiertos/)).toBeInTheDocument();
  });

  it("avisa si falta pagar la compra con tarjeta", () => {
    renderUnit([unit({ unit_id: CO, checkout_id: CO, order_count: 2, total: 420, payment_status: "pendiente" })], [order({ id: "o2", number: 2, checkout_id: CO, status: "pendiente_pago" }), order({ id: "o3", number: 3, checkout_id: CO, status: "pendiente_pago" })]);
    expect(screen.getByText("Falta pagar")).toBeInTheDocument();
  });

  it("dice que todos terminaron cuando ya no queda ninguno abierto", () => {
    renderUnit([unit({ unit_id: CO, checkout_id: CO, order_count: 2 })], [order({ id: "o2", number: 2, checkout_id: CO, status: "entregado" }), order({ id: "o3", number: 3, checkout_id: CO, status: "cancelado" })]);
    expect(screen.getByText(/todos terminaron/)).toBeInTheDocument();
  });
});
