import { describe, expect, it } from "vitest";
import { buildUnits, isMultiOrder, openOrders, ordersFilter, type ListedOrder, type UnitRow } from "./purchases";

const CO = "c0000000-0000-4000-8000-000000000001";
const order = (over: Partial<ListedOrder>): ListedOrder => ({
  id: "o1",
  number: 1,
  checkout_id: null,
  store_name: "Tienda A",
  status: "por_confirmar",
  total: 100,
  item_count: 1,
  created_at: "2026-10-22T10:00:00Z",
  delivery_class: "express",
  eta_min_days: null,
  eta_max_days: null,
  ...over,
});
const unit = (over: Partial<UnitRow>): UnitRow => ({ unit_id: "o1", checkout_id: null, created_at: "2026-10-22T10:00:00Z", order_count: 1, total: 100, payment_status: null, ...over });

describe("buildUnits", () => {
  it("agrupa los pedidos de una compra y deja los sueltos aparte, en el orden de las unidades", () => {
    const units = [unit({ unit_id: CO, checkout_id: CO, order_count: 2, total: 420, payment_status: "pendiente" }), unit({ unit_id: "o9", total: 90 })];
    const orders = [order({ id: "o9", number: 9, total: 90 }), order({ id: "o3", number: 3, checkout_id: CO, total: 70 }), order({ id: "o2", number: 2, checkout_id: CO, total: 350 })];
    const result = buildUnits(units, orders);
    expect(result.map((u) => u.id)).toEqual([CO, "o9"]);
    expect(result[0]!.orders.map((o) => o.number)).toEqual([2, 3]);
    expect(result[0]!.total).toBe(420);
    expect(result[0]!.paymentStatus).toBe("pendiente");
    expect(result[1]!.orders).toHaveLength(1);
  });

  it("descarta unidades sin pedidos o sin identificador", () => {
    expect(buildUnits([unit({ unit_id: "x" }), unit({ unit_id: null })], [])).toEqual([]);
  });

  it("si la unidad no trae total, lo suma de sus pedidos", () => {
    const result = buildUnits([unit({ unit_id: CO, checkout_id: CO, total: null })], [order({ id: "a", number: 1, checkout_id: CO, total: 10 }), order({ id: "b", number: 2, checkout_id: CO, total: 15 })]);
    expect(result[0]!.total).toBe(25);
  });
});

describe("isMultiOrder / openOrders", () => {
  it("una compra de un solo pedido se ve como un pedido normal", () => {
    const [single] = buildUnits([unit({ unit_id: CO, checkout_id: CO })], [order({ id: "a", checkout_id: CO })]);
    expect(isMultiOrder(single!)).toBe(false);
    const [multi] = buildUnits([unit({ unit_id: CO, checkout_id: CO })], [order({ id: "a", number: 1, checkout_id: CO }), order({ id: "b", number: 2, checkout_id: CO })]);
    expect(isMultiOrder(multi!)).toBe(true);
  });

  it("cuenta los pedidos que siguen abiertos", () => {
    const [multi] = buildUnits(
      [unit({ unit_id: CO, checkout_id: CO })],
      [order({ id: "a", number: 1, checkout_id: CO, status: "entregado" }), order({ id: "b", number: 2, checkout_id: CO, status: "en_camino" }), order({ id: "c", number: 3, checkout_id: CO, status: "cancelado" })],
    );
    expect(openOrders(multi!)).toBe(1);
  });
});

describe("ordersFilter", () => {
  it("pide los sueltos por id y las compras por checkout_id", () => {
    expect(ordersFilter([unit({ unit_id: "o9" }), unit({ unit_id: CO, checkout_id: CO })])).toBe(`id.in.(o9),checkout_id.in.(${CO})`);
    expect(ordersFilter([unit({ unit_id: "o9" })])).toBe("id.in.(o9)");
    expect(ordersFilter([unit({ unit_id: CO, checkout_id: CO })])).toBe(`checkout_id.in.(${CO})`);
    expect(ordersFilter([])).toBeNull();
  });
});
