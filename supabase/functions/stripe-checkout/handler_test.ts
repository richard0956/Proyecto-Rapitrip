import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { StripeError } from "../_shared/stripe.ts";
import { payOrder, payPurchase, type Deps, type QueryClient } from "./handler.ts";

type Row = Record<string, unknown>;

/** Constructor de consultas de mentira: select / eq / in / order y resultado con `maybeSingle` o al esperar el objeto. */
class FakeQuery {
  private filters: ((row: Row) => boolean)[] = [];
  private sortKey: string | null = null;
  constructor(private rows: Row[]) {}
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push((row) => row[key] === value); return this; }
  in(key: string, values: unknown[]) { this.filters.push((row) => values.includes(row[key])); return this; }
  order(key: string) { this.sortKey = key; return this; }
  private result() {
    const rows = this.rows.filter((row) => this.filters.every((f) => f(row)));
    const key = this.sortKey;
    return key ? [...rows].sort((a, b) => Number(a[key]) - Number(b[key])) : rows;
  }
  maybeSingle() { return Promise.resolve({ data: this.result()[0] ?? null, error: null }); }
  then(resolve: (value: { data: Row[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve({ data: this.result(), error: null }).then(resolve, reject);
  }
}

function fake(tables: Record<string, Row[]>, rpc: QueryClient["rpc"] = () => Promise.resolve({ data: null, error: null })): QueryClient {
  return { from: (name: string) => new FakeQuery(tables[name] ?? []), rpc };
}

const CHECKOUT = "c0000000-0000-4000-8000-000000000001";
const A = "a0000000-0000-4000-8000-000000000001";
const B = "b0000000-0000-4000-8000-000000000002";
const CANCELLED = "e0000000-0000-4000-8000-000000000003";

const checkoutRow = { id: CHECKOUT, payment_method: "tarjeta", payment_status: "pendiente" };
const orders = [
  { id: B, number: 11, store_name: "Tienda B", delivery_fee: "120.00", delivery_class: "programado", checkout_id: CHECKOUT, status: "pendiente_pago", payment_method: "tarjeta" },
  { id: A, number: 10, store_name: "Tienda A", delivery_fee: "50.00", delivery_class: "express", checkout_id: CHECKOUT, status: "pendiente_pago", payment_method: "tarjeta" },
  { id: CANCELLED, number: 12, store_name: "Tienda C", delivery_fee: "50.00", delivery_class: "express", checkout_id: CHECKOUT, status: "cancelado" },
];
const items = [
  { order_id: A, product_name: "Café", variant_name: "500 g", unit_price: "150.00", quantity: 2 },
  { order_id: B, product_name: "Sillón", variant_name: "Gris", unit_price: "8000.00", quantity: 1 },
  { order_id: CANCELLED, product_name: "Pan", variant_name: "Unidad", unit_price: "20.00", quantity: 1 },
];

function setup(over: { tables?: Record<string, Row[]>; recordError?: unknown; previous?: string | null; stripeFails?: boolean } = {}) {
  const calls: { method: string; path: string; params?: Record<string, string> }[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const deps: Deps = {
    storeUrl: "http://127.0.0.1:3000",
    currency: "nio",
    asCaller: fake({ my_checkouts: [checkoutRow], orders_list: orders, order_items_list: items, ...over.tables }),
    admin: fake({}, (name, args) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(over.recordError ? { data: null, error: over.recordError } : { data: { previous_session: over.previous ?? null }, error: null });
    }),
    // deno-lint-ignore no-explicit-any
    stripe: ((method: string, path: string, params?: Record<string, string>) => {
      calls.push({ method, path, params });
      if (over.stripeFails && path === "/v1/checkout/sessions") return Promise.reject(new StripeError(500, "caído"));
      return Promise.resolve({ id: "cs_test_nueva0001", url: "https://stripe.test/pay" });
    }) as any,
  };
  return { deps, calls, rpcCalls };
}

Deno.test("payPurchase: una sesión con solo los pedidos que esperan pago, y la registra", async () => {
  const { deps, calls, rpcCalls } = setup();
  const outcome = await payPurchase(deps, CHECKOUT);
  assertEquals(outcome, { status: 200, body: { url: "https://stripe.test/pay", session_id: "cs_test_nueva0001" } });
  assertEquals(calls.length, 1);
  const params = calls[0]!.params!;
  assertEquals(params.client_reference_id, CHECKOUT);
  assertEquals(params["metadata[checkout_id]"], CHECKOUT);
  // Café ×2 + envío express A, sillón + envío programado B; el pedido cancelado no entra.
  let total = 0;
  for (let i = 0; params[`line_items[${i}][quantity]`] !== undefined; i++) {
    total += Number(params[`line_items[${i}][quantity]`]) * Number(params[`line_items[${i}][price_data][unit_amount]`]);
    assertEquals(params[`line_items[${i}][price_data][product_data][name]`].includes("Pan"), false);
  }
  assertEquals(total, 30000 + 5000 + 800000 + 12000);
  assertEquals(rpcCalls, [{ name: "record_checkout_payment_session", args: { p_checkout: CHECKOUT, p_session: "cs_test_nueva0001", p_currency: "nio" } }]);
});

Deno.test("payPurchase: ordena los pedidos por número y vence la sesión anterior", async () => {
  const { deps, calls } = setup({ previous: "cs_test_vieja0001" });
  await payPurchase(deps, CHECKOUT);
  assertStringIncludes(calls[0]!.params!["line_items[0][price_data][product_data][name]"], "Café");
  assertEquals(calls.at(-1)!.path, "/v1/checkout/sessions/cs_test_vieja0001/expire");
});

Deno.test("payPurchase: compra ajena o inexistente → 404", async () => {
  const { deps, calls } = setup({ tables: { my_checkouts: [] } });
  assertEquals((await payPurchase(deps, CHECKOUT)).status, 404);
  assertEquals(calls.length, 0);
});

Deno.test("payPurchase: una compra que no espera pago con tarjeta → 409 sin tocar Stripe", async () => {
  for (const row of [{ ...checkoutRow, payment_status: "pagado" }, { ...checkoutRow, payment_status: "vencido" }, { ...checkoutRow, payment_method: "efectivo", payment_status: "no_aplica" }]) {
    const { deps, calls } = setup({ tables: { my_checkouts: [row] } });
    assertEquals((await payPurchase(deps, CHECKOUT)).status, 409);
    assertEquals(calls.length, 0);
  }
});

Deno.test("payPurchase: sin pedidos esperando pago → 409", async () => {
  const { deps, calls } = setup({ tables: { orders_list: orders.map((o) => ({ ...o, status: "cancelado" })) } });
  assertEquals((await payPurchase(deps, CHECKOUT)).status, 409);
  assertEquals(calls.length, 0);
});

Deno.test("payPurchase: si no se puede registrar la sesión, se vence y se responde 409", async () => {
  const { deps, calls } = setup({ recordError: { message: "la compra no espera un pago" } });
  const outcome = await payPurchase(deps, CHECKOUT);
  assertEquals(outcome.status, 409);
  assertEquals(calls.at(-1)!.path, "/v1/checkout/sessions/cs_test_nueva0001/expire");
});

Deno.test("payPurchase: si Stripe falla → 502 y no se registra nada", async () => {
  const { deps, rpcCalls } = setup({ stripeFails: true });
  assertEquals((await payPurchase(deps, CHECKOUT)).status, 502);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("payOrder: un pedido de una compra pagada de una vez no abre su propia sesión", async () => {
  const { deps, calls } = setup();
  const outcome = await payOrder(deps, A);
  assertEquals(outcome.status, 409);
  assertEquals((outcome.body as { checkout_id: string }).checkout_id, CHECKOUT);
  assertEquals(calls.length, 0);
});

Deno.test("payOrder: un pedido suelto abre su sesión y la registra", async () => {
  const solo = { id: A, number: 10, store_name: "Tienda A", status: "pendiente_pago", payment_method: "tarjeta", delivery_fee: "50.00", checkout_id: null };
  const { deps, calls, rpcCalls } = setup({ tables: { orders_list: [solo] } });
  const outcome = await payOrder(deps, A);
  assertEquals(outcome.status, 200);
  assertEquals(calls[0]!.params!["metadata[order_id]"], A);
  assertEquals(rpcCalls[0]!.name, "record_order_checkout_session");
});

Deno.test("payOrder: un pedido ya pagado o en efectivo → 409", async () => {
  for (const patch of [{ status: "por_confirmar" }, { payment_method: "efectivo" }]) {
    const solo = { id: A, number: 10, store_name: "Tienda A", status: "pendiente_pago", payment_method: "tarjeta", delivery_fee: "50.00", checkout_id: null, ...patch };
    const { deps, calls } = setup({ tables: { orders_list: [solo] } });
    assertEquals((await payOrder(deps, A)).status, 409);
    assertEquals(calls.length, 0);
  }
});
