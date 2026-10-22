import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, invoke, requireCustomer } = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), requireCustomer: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ serverSupabase: async () => ({ rpc, functions: { invoke } }) }));
vi.mock("@/lib/session", () => ({ requireCustomer }));

import { placeCheckout, quoteGroupAction, startCardPayment, startCheckoutPayment } from "./actions";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const V = "00000000-0000-4000-8000-000000000001";
const CHECKOUT = "c0000000-0000-4000-8000-000000000001";
const ORDER = "a0000000-0000-4000-8000-000000000001";
const QUOTE = "d0000000-0000-4000-8000-000000000001";

/** Error de una función de borde, con el cuerpo que la función devolvió. */
const edgeError = (status: number, body: unknown = {}) => ({ message: "edge", context: { status, json: async () => body } });

const purchase = (over: Record<string, unknown> = {}) => ({
  groups: [{ store_id: A, items: [{ variant_id: V, quantity: 2 }], quote_id: QUOTE }, { store_id: B, items: [{ variant_id: V, quantity: 1 }] }],
  payment_method: "efectivo",
  address: "Barrio Central, casa 4",
  phone: "88881111",
  client_ref: CHECKOUT,
  latitude: 12.1364,
  longitude: -86.2514,
  ...over,
});

const placed = (over: Record<string, unknown> = {}) => ({ data: { checkout_id: CHECKOUT, payment_status: "no_aplica", orders: [{ order_id: ORDER }, { order_id: "o2" }], ...over }, error: null });

/** El departamento de cada punto lo deduce la base de datos; las acciones lo piden antes de cotizar o crear la compra. */
const department = (code: string | null = "managua", error: unknown = null) => rpc.mockResolvedValueOnce({ data: code, error });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireCustomer.mockResolvedValue({ signedIn: true });
});

describe("placeCheckout", () => {
  it("rechaza datos inválidos sin llamar a la base de datos", async () => {
    const result = await placeCheckout(purchase({ latitude: 120 }));
    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("en efectivo crea la compra con las tiendas, sin precios, y no abre ningún pago", async () => {
    department();
    rpc.mockResolvedValueOnce(placed());
    const result = await placeCheckout(purchase());
    expect(rpc).toHaveBeenCalledWith("create_checkout", expect.objectContaining({
      p_groups: [{ store_id: A, items: [{ variant_id: V, quantity: 2 }], quote_id: QUOTE }, { store_id: B, items: [{ variant_id: V, quantity: 1 }] }],
      p_payment_method: "efectivo",
      p_department: "managua",
      p_client_ref: CHECKOUT,
    }));
    expect(invoke).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, checkoutId: CHECKOUT, payUrl: null });
  });

  it("con tarjeta y varios pedidos paga toda la compra con una sola sesión", async () => {
    department();
    rpc.mockResolvedValueOnce(placed({ payment_status: "pendiente" }));
    invoke.mockResolvedValueOnce({ data: { url: "https://stripe.test/cs_1" }, error: null });
    const result = await placeCheckout(purchase({ payment_method: "tarjeta" }));
    expect(invoke).toHaveBeenCalledWith("stripe-checkout", { body: { checkout_id: CHECKOUT } });
    expect(result).toMatchObject({ ok: true, payUrl: "https://stripe.test/cs_1" });
  });

  it("con tarjeta y un solo pedido paga el pedido, como siempre", async () => {
    department();
    rpc.mockResolvedValueOnce(placed({ payment_status: "no_aplica", orders: [{ order_id: ORDER }] }));
    invoke.mockResolvedValueOnce({ data: { url: "https://stripe.test/cs_2" }, error: null });
    const result = await placeCheckout(purchase({ payment_method: "tarjeta", groups: [{ store_id: A, items: [{ variant_id: V, quantity: 1 }] }] }));
    expect(invoke).toHaveBeenCalledWith("stripe-checkout", { body: { order_id: ORDER } });
    expect(result).toMatchObject({ ok: true, payUrl: "https://stripe.test/cs_2" });
  });

  it("si Stripe no abre, la compra queda creada y se avisa del pago", async () => {
    department();
    rpc.mockResolvedValueOnce(placed({ payment_status: "pendiente" }));
    invoke.mockResolvedValueOnce({ data: null, error: edgeError(502) });
    const result = await placeCheckout(purchase({ payment_method: "tarjeta" }));
    expect(result).toMatchObject({ ok: true, checkoutId: CHECKOUT, payUrl: null });
    expect(result.ok && result.payError).toMatch(/No pudimos iniciar el pago/);
  });

  it("con la sesión vencida lo avisa para llevar a ingresar", async () => {
    department();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "tu sesión venció" } });
    expect(await placeCheckout(purchase())).toMatchObject({ ok: false, expired: true });
  });

  it("devuelve el motivo de la base de datos si una tienda falla", async () => {
    department();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "Tienda B: la tienda está cerrada en este momento" } });
    expect(await placeCheckout(purchase())).toEqual({ ok: false, error: "Tienda B: la tienda está cerrada en este momento" });
  });

  it("guarda la dirección con su departamento, y si eso falla la compra sigue en pie", async () => {
    department();
    rpc
      .mockResolvedValueOnce(placed())
      .mockResolvedValueOnce({ data: "addr-1", error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const result = await placeCheckout(purchase({ save_address_as: "Casa" }));
    expect(rpc).toHaveBeenNthCalledWith(1, "department_for_point", { p_latitude: 12.1364, p_longitude: -86.2514 });
    expect(rpc).toHaveBeenNthCalledWith(3, "save_address", expect.objectContaining({ p_label: "Casa", p_latitude: 12.1364 }));
    expect(rpc).toHaveBeenNthCalledWith(4, "set_address_department", { p_id: "addr-1", p_department: "managua" });
    expect(result.ok).toBe(true);

    rpc.mockReset();
    department();
    rpc.mockResolvedValueOnce(placed()).mockResolvedValueOnce({ data: null, error: { code: "22023", message: "puedes guardar hasta 10 direcciones" } });
    expect((await placeCheckout(purchase({ save_address_as: "Casa" }))).ok).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("el departamento sale del punto del mapa, no de lo que mande el navegador", async () => {
    department("leon");
    rpc.mockResolvedValueOnce(placed());
    await placeCheckout(purchase({ department: "managua" }));
    expect(rpc).toHaveBeenNthCalledWith(2, "create_checkout", expect.objectContaining({ p_department: "leon" }));
  });

  it("un punto fuera de Nicaragua se rechaza sin crear la compra", async () => {
    department(null);
    const result = await placeCheckout(purchase());
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/fuera de Nicaragua/) });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("quoteGroupAction", () => {
  const input = { store_id: A, items: [{ variant_id: V, quantity: 1 }], latitude: 12.1364, longitude: -86.2514 };
  const group = { origin_department: "managua", destination_department: "managua", shipments: [{ delivery_class: "express" }] };

  it("pide la ruta por calle y la usa para cotizar", async () => {
    invoke.mockResolvedValueOnce({ data: { quote_id: QUOTE }, error: null });
    department();
    rpc.mockResolvedValueOnce({ data: group, error: null });
    const result = await quoteGroupAction(input);
    expect(rpc).toHaveBeenCalledWith("quote_delivery_group", expect.objectContaining({ p_store: A, p_department: "managua", p_quote_id: QUOTE }));
    expect(result).toMatchObject({ ok: true, quoteId: QUOTE, origin_department: "managua" });
  });

  it("sin ruta por calle cotiza sin cotización previa", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: edgeError(422) });
    department();
    rpc.mockResolvedValueOnce({ data: group, error: null });
    const result = await quoteGroupAction(input);
    expect(rpc.mock.calls[1]![1]).not.toHaveProperty("p_quote_id");
    expect(result).toMatchObject({ ok: true, quoteId: null });
  });

  it("si la cotización por ruta no sirve, vuelve a cotizar sin ella en vez de fallar", async () => {
    invoke.mockResolvedValueOnce({ data: { quote_id: QUOTE }, error: null });
    department();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "la cotización del envío venció" } }).mockResolvedValueOnce({ data: group, error: null });
    const result = await quoteGroupAction(input);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[2]![1]).not.toHaveProperty("p_quote_id");
    expect(result).toMatchObject({ ok: true, quoteId: null });
  });

  it("con la sesión vencida en la función de borde lo avisa", async () => {
    department();
    invoke.mockResolvedValueOnce({ data: null, error: edgeError(401) });
    expect(await quoteGroupAction(input)).toMatchObject({ ok: false, expired: true });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("devuelve el motivo si la tienda no puede entregar", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: edgeError(422) });
    department();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023", message: "el envío programado a esa distancia aún no está disponible" } });
    expect(await quoteGroupAction(input)).toEqual({ ok: false, error: "el envío programado a esa distancia aún no está disponible" });
  });

  it("pide el punto del mapa antes de cotizar", async () => {
    const result = await quoteGroupAction({ ...input, latitude: undefined });
    expect(result.ok).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("un punto fuera de Nicaragua no se cotiza", async () => {
    department(null);
    expect(await quoteGroupAction(input)).toMatchObject({ ok: false, error: expect.stringMatching(/fuera de Nicaragua/) });
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("startCheckoutPayment / startCardPayment", () => {
  it("abre el pago de toda la compra", async () => {
    invoke.mockResolvedValueOnce({ data: { url: "https://stripe.test/cs_3" }, error: null });
    expect(await startCheckoutPayment(CHECKOUT)).toEqual({ ok: true, url: "https://stripe.test/cs_3" });
    expect(invoke).toHaveBeenCalledWith("stripe-checkout", { body: { checkout_id: CHECKOUT } });
  });

  it("traduce los errores de la función de borde", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: edgeError(409) });
    expect(await startCheckoutPayment(CHECKOUT)).toEqual({ ok: false, error: "Esta compra ya no espera un pago." });
    invoke.mockResolvedValueOnce({ data: null, error: edgeError(401) });
    expect(await startCheckoutPayment(CHECKOUT)).toMatchObject({ ok: false, expired: true });
  });

  it("rechaza una compra con identificador inválido", async () => {
    expect(await startCheckoutPayment("no-es-uuid")).toEqual({ ok: false, error: "Compra inválida." });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("un pedido de una compra pagada de una vez remite a la compra en vez de abrir otra sesión", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: edgeError(409, { error: "este pedido se paga junto con su compra", checkout_id: CHECKOUT }) });
    expect(await startCardPayment(ORDER)).toEqual({ ok: false, error: "Este pedido se paga junto con el resto de tu compra." });
  });

  it("un pedido que ya no espera pago lo dice", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: edgeError(409, { error: "el pedido no espera un pago con tarjeta" }) });
    expect(await startCardPayment(ORDER)).toEqual({ ok: false, error: "Este pedido ya no espera un pago." });
  });
});
