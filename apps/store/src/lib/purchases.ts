/** Una unidad del listado de pedidos: una compra con todos sus pedidos, o un pedido suelto (anterior a las compras con varias tiendas). */
export type UnitRow = { unit_id: string | null; checkout_id: string | null; created_at: string | null; order_count: number | null; total: number | null; payment_status: string | null };

export type ListedOrder = {
  id: string;
  number: number;
  checkout_id: string | null;
  store_name: string;
  status: string;
  total: number;
  item_count: number;
  created_at: string | null;
  delivery_class: "express" | "programado";
  eta_min_days: number | null;
  eta_max_days: number | null;
};

export type OrderUnit = {
  id: string;
  checkoutId: string | null;
  createdAt: string | null;
  total: number;
  /** Estado del pago de la compra: «pendiente» si falta pagar con tarjeta. */
  paymentStatus: string | null;
  orders: ListedOrder[];
};

/** Estados en los que un pedido ya no necesita nada del cliente. */
const FINAL = new Set(["entregado", "cancelado", "rechazado"]);

/**
 * Une las unidades de una página con sus pedidos, conservando el orden de las unidades (la más reciente primero) y ordenando
 * los pedidos de cada una por número. Una unidad sin pedidos visibles (no debería ocurrir) se descarta.
 */
export function buildUnits(units: UnitRow[], orders: ListedOrder[]): OrderUnit[] {
  const byUnit = new Map<string, ListedOrder[]>();
  for (const order of orders) {
    const key = order.checkout_id ?? order.id;
    byUnit.set(key, [...(byUnit.get(key) ?? []), order]);
  }
  return units.flatMap((unit) => {
    if (!unit.unit_id) return [];
    const found = [...(byUnit.get(unit.unit_id) ?? [])].sort((a, b) => a.number - b.number);
    if (found.length === 0) return [];
    return [
      {
        id: unit.unit_id,
        checkoutId: unit.checkout_id,
        createdAt: unit.created_at,
        total: Number(unit.total ?? found.reduce((sum, order) => sum + order.total, 0)),
        paymentStatus: unit.payment_status,
        orders: found,
      },
    ];
  });
}

/** ¿Se muestra como una compra con varios pedidos? Una compra de un solo pedido se ve como un pedido normal. */
export const isMultiOrder = (unit: OrderUnit) => unit.checkoutId !== null && unit.orders.length > 1;

/** Cuántos pedidos de la unidad siguen abiertos. */
export const openOrders = (unit: OrderUnit) => unit.orders.filter((order) => !FINAL.has(order.status)).length;

/** Condición de PostgREST para pedir los pedidos de las unidades de una página: los sueltos por id y las compras por `checkout_id`. */
export function ordersFilter(units: UnitRow[]): string | null {
  const checkouts = units.flatMap((unit) => (unit.checkout_id ? [unit.checkout_id] : []));
  const singles = units.flatMap((unit) => (!unit.checkout_id && unit.unit_id ? [unit.unit_id] : []));
  const parts = [singles.length ? `id.in.(${singles.join(",")})` : null, checkouts.length ? `checkout_id.in.(${checkouts.join(",")})` : null].filter((part): part is string => part !== null);
  return parts.length ? parts.join(",") : null;
}
