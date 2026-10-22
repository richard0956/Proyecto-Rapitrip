import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }));

import { addToCart, emptyCart } from "@/lib/cart";
import { CART_KEY, resetCartStoreForTests, setCart } from "@/lib/cart-store";
import type { Quote } from "@/lib/catalog";
import type { Shipment } from "@/lib/delivery-class";
import { CheckoutForm } from "./checkout-form";

const STORE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const VARIANT = "00000000-0000-4000-8000-000000000001";
const OTHER_VARIANT = "00000000-0000-4000-8000-000000000002";

const line = (variant: string, name: string, price: number, quantity: number) => ({ variant_id: variant, product_id: `p-${variant}`, product_name: name, variant_name: "u", cover_path: null, unit_price: price, quantity, line_total: price * quantity, available: true, max_per_order: null });
const quoteA: Quote = { store: { id: STORE, name: "Tienda A", open_now: true }, lines: [line(VARIANT, "Café", 100, 2)], subtotal: 200, delivery_fee: 0, total: 200, problems: [] };
const quoteB: Quote = { store: { id: OTHER, name: "Tienda B", open_now: true }, lines: [line(OTHER_VARIANT, "Pan", 20, 1)], subtotal: 20, delivery_fee: 0, total: 20, problems: [] };

const express = (items: Shipment["items"], fee = 50): Shipment => ({ delivery_class: "express", reason: null, items, zone: 1, band: null, customer_fee: fee, eta_min_days: null, eta_max_days: null });
const programado = (items: Shipment["items"], reason: Shipment["reason"] = "producto"): Shipment => ({ delivery_class: "programado", reason, items, zone: null, band: 1, customer_fee: 120, eta_min_days: 3, eta_max_days: 7 });

const quoteAction = vi.fn();
const quoteGroup = vi.fn();
const placeCheckout = vi.fn();

const groupQuote = (shipments: (items: Shipment["items"]) => Shipment[], quoteId = "q-1") =>
  ({ ok: true, quoteId, origin_department: "managua", destination_department: "managua", shipments: shipments([]) });

beforeEach(() => {
  vi.clearAllMocks();
  quoteAction.mockImplementation(async ({ storeId }: { storeId: string }) => ({ ok: true, quote: storeId === OTHER ? quoteB : quoteA }));
  quoteGroup.mockImplementation(async ({ items }: { items: Shipment["items"] }) => ({ ...groupQuote(() => []), shipments: [express(items)] }));
  placeCheckout.mockResolvedValue({ ok: true, checkoutId: "c1", orders: [{ order_id: "o1" }], payUrl: null });
  localStorage.clear();
  sessionStorage.clear();
  resetCartStoreForTests();
  setCart(addToCart(emptyCart, { storeId: STORE, storeName: "Tienda A", variantId: VARIANT, quantity: 2, seenPrice: 100 }).cart);
});

const saved = [{ id: "a1", label: "Casa", address: "Barrio Central, casa 4", phone: "88881111", is_default: true, latitude: 12.1364, longitude: -86.2514, department: "managua" }];
const props = (over: Partial<Parameters<typeof CheckoutForm>[0]> = {}) => ({ addresses: saved, profilePhone: "", quoteAction, quoteGroup, placeCheckout, ...over });

function mockGeolocation(lat: number, lng: number) {
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: lat, longitude: lng } }) }, configurable: true });
}

async function ready(label = "Confirmar pedido") {
  const confirm = await screen.findByRole("button", { name: label });
  await waitFor(() => expect(confirm).toBeEnabled());
  return confirm;
}

describe("CheckoutForm", () => {
  it("con el carrito vacío invita a explorar las tiendas", async () => {
    setCart(emptyCart);
    render(<CheckoutForm {...props()} />);
    expect(await screen.findByText("Tu carrito está vacío")).toBeInTheDocument();
  });

  it("usa la dirección predeterminada, cotiza el envío y manda la compra sin precios", async () => {
    render(<CheckoutForm {...props()} />);
    const confirm = await ready();
    expect(screen.getByText("Express")).toBeInTheDocument();
    expect(screen.getByText("Llega en pocas horas")).toBeInTheDocument();
    expect(quoteGroup).toHaveBeenCalledWith({ store_id: STORE, items: [{ variant_id: VARIANT, quantity: 2 }], latitude: 12.1364, longitude: -86.2514 });
    await userEvent.setup().click(confirm);
    await waitFor(() => expect(placeCheckout).toHaveBeenCalledTimes(1));
    const sent = placeCheckout.mock.calls[0]![0];
    expect(sent).toMatchObject({ payment_method: "efectivo", address: "Barrio Central, casa 4", phone: "88881111", latitude: 12.1364, longitude: -86.2514 });
    expect(sent).not.toHaveProperty("department");
    expect(sent.groups).toEqual([{ store_id: STORE, items: [{ variant_id: VARIANT, quantity: 2 }], quote_id: "q-1" }]);
    expect(sent.client_ref).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pedidos/o1"));
    expect(localStorage.getItem(CART_KEY)).toBeNull();
  });

  it("un doble clic no envía dos compras", async () => {
    let finish: (value: unknown) => void = () => {};
    placeCheckout.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<CheckoutForm {...props()} />);
    await userEvent.setup().dblClick(await ready());
    expect(placeCheckout).toHaveBeenCalledTimes(1);
    finish({ ok: true, checkoutId: "c1", orders: [{ order_id: "o1" }], payUrl: null });
  });

  it("sin punto de entrega no deja confirmar ni cotiza", async () => {
    render(<CheckoutForm {...props({ addresses: [], profilePhone: "88881111" })} />);
    expect(await screen.findByRole("button", { name: "Marca tu punto de entrega" })).toBeDisabled();
    expect(quoteGroup).not.toHaveBeenCalled();
  });

  it("ya no pide el departamento: basta el punto del mapa", async () => {
    render(<CheckoutForm {...props({ addresses: [{ ...saved[0]!, department: null }] })} />);
    await ready();
    expect(screen.queryByLabelText("Departamento de entrega")).not.toBeInTheDocument();
    expect(quoteGroup).toHaveBeenCalledWith(expect.not.objectContaining({ department: expect.anything() }));
  });

  it("con el punto marcado exige además una dirección escrita", async () => {
    mockGeolocation(12.1364, -86.2514);
    render(<CheckoutForm {...props({ addresses: [], profilePhone: "88881111" })} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Usar mi ubicación" }));
    await user.click(await ready());
    expect(await screen.findByRole("alert")).toHaveTextContent("Escribe la dirección de entrega");
    expect(placeCheckout).not.toHaveBeenCalled();
  });

  it("una tienda sin cobertura avisa y no deja confirmar", async () => {
    quoteGroup.mockResolvedValue({ ok: false, error: "El envío programado a esa distancia aún no está disponible." });
    render(<CheckoutForm {...props()} />);
    expect(await screen.findByText(/aún no está disponible/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar pedido|Calculando el envío/ })).toBeDisabled();
  });

  it("con la sesión vencida guarda un borrador y lleva a ingresar", async () => {
    placeCheckout.mockResolvedValue({ ok: false, error: "Tu sesión venció.", expired: true });
    render(<CheckoutForm {...props()} />);
    await userEvent.setup().click(await ready());
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/ingresar?next=${encodeURIComponent("/checkout")}&expirada=1`));
    expect(JSON.parse(sessionStorage.getItem("rapitrip:checkout") ?? "{}")).toMatchObject({ addressId: "a1", method: "efectivo" });
    // El carrito se conserva para cuando vuelva.
    expect(localStorage.getItem(CART_KEY)).not.toBeNull();
  });

  it("no deja pagar mientras haya un cambio de precio sin aceptar", async () => {
    quoteAction.mockResolvedValue({ ok: true, quote: { ...quoteA, problems: [{ code: "precio_cambiado", variant_id: VARIANT, product_name: "Café", old_price: 90, new_price: 100 }] } });
    render(<CheckoutForm {...props()} />);
    expect(await screen.findByText(/cambió de/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pedido" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Aceptar los nuevos precios" })).toBeInTheDocument();
  });

  it("si la cotización del envío venció, pide otra y deja confirmar de nuevo", async () => {
    placeCheckout.mockResolvedValueOnce({ ok: false, error: "La cotización del envío venció: marca de nuevo tu punto de entrega." });
    render(<CheckoutForm {...props()} />);
    const confirm = await ready();
    expect(quoteGroup).toHaveBeenCalledTimes(1);
    quoteGroup.mockImplementation(async ({ items }: { items: Shipment["items"] }) => ({ ...groupQuote(() => []), quoteId: "q-2", shipments: [express(items)] }));
    await userEvent.setup().click(confirm);
    await waitFor(() => expect(quoteGroup).toHaveBeenCalledTimes(2));
    await userEvent.setup().click(await ready());
    await waitFor(() => expect(placeCheckout).toHaveBeenCalledTimes(2));
    expect(placeCheckout.mock.calls[1]![0].groups[0].quote_id).toBe("q-2");
  });

  it("un producto grande sale como programado, con su plazo y su razón", async () => {
    quoteGroup.mockImplementation(async ({ items }: { items: Shipment["items"] }) => ({ ...groupQuote(() => []), shipments: [programado(items)] }));
    render(<CheckoutForm {...props()} />);
    await ready();
    expect(screen.getByText("Programado")).toBeInTheDocument();
    expect(screen.getByText("Llega en 3 a 7 días")).toBeInTheDocument();
    expect(screen.getByText(/Producto grande o con preparación/)).toBeInTheDocument();
  });

  describe("compra con varias tiendas", () => {
    beforeEach(() => {
      setCart(addToCart(addToCart(emptyCart, { storeId: STORE, storeName: "Tienda A", variantId: VARIANT, quantity: 2, seenPrice: 100 }).cart, { storeId: OTHER, storeName: "Tienda B", variantId: OTHER_VARIANT, quantity: 1, seenPrice: 20 }).cart);
      placeCheckout.mockResolvedValue({ ok: true, checkoutId: "c9", orders: [{ order_id: "o1" }, { order_id: "o2" }], payUrl: null });
    });

    it("cotiza cada tienda, suma los envíos y crea una sola compra", async () => {
      render(<CheckoutForm {...props()} />);
      const confirm = await ready("Confirmar compra");
      expect(quoteGroup).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Envíos (2)")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Entrega de Tienda B" })).toBeInTheDocument();
      await userEvent.setup().click(confirm);
      await waitFor(() => expect(placeCheckout).toHaveBeenCalledTimes(1));
      expect(placeCheckout.mock.calls[0]![0].groups.map((g: { store_id: string }) => g.store_id)).toEqual([STORE, OTHER]);
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/compras/c9"));
      expect(localStorage.getItem(CART_KEY)).toBeNull();
    });

    it("la tarjeta paga toda la compra de varias entregas: se confirma y se paga", async () => {
      render(<CheckoutForm {...props()} />);
      await ready("Confirmar compra");
      const card = screen.getByLabelText(/Tarjeta/);
      expect(card).toBeEnabled();
      expect(screen.getByText(/toda la compra, en un solo cobro/)).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(card);
      const confirm = await screen.findByRole("button", { name: "Confirmar y pagar" });
      await waitFor(() => expect(confirm).toBeEnabled());
      placeCheckout.mockResolvedValue({ ok: true, checkoutId: "c9", orders: [{ order_id: "o1" }, { order_id: "o2" }], payUrl: null, payError: "No pudimos iniciar el pago." });
      await user.click(confirm);
      await waitFor(() => expect(placeCheckout).toHaveBeenCalledTimes(1));
      expect(placeCheckout.mock.calls[0]![0]).toMatchObject({ payment_method: "tarjeta" });
      // Si Stripe no abrió, la compra queda creada y se paga desde su pantalla.
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/compras/c9?pago=error"));
    });

    it("al quitar una tienda, el total de envíos deja de contarla enseguida", async () => {
      render(<CheckoutForm {...props()} />);
      await ready("Confirmar compra");
      expect(screen.getByText("Envíos (2)")).toBeInTheDocument();
      const section = screen.getByRole("region", { name: "Entrega de Tienda B" });
      await userEvent.setup().click(within(section).getByRole("button", { name: "Quitar tienda" }));
      // Sin esperar a la recotización: la cotización de la tienda quitada no debe sumarse.
      expect(screen.queryByText("Envíos (2)")).not.toBeInTheDocument();
      await ready();
    });

    it("una tienda con error de envío se puede quitar para seguir con las demás", async () => {
      quoteGroup.mockImplementation(async ({ store_id, items }: { store_id: string; items: Shipment["items"] }) =>
        store_id === OTHER ? { ok: false, error: "Esta tienda no entrega en tu zona." } : { ...groupQuote(() => []), shipments: [express(items)] },
      );
      render(<CheckoutForm {...props()} />);
      expect(await screen.findByText("Esta tienda no entrega en tu zona.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar/ })).toBeDisabled();
      const section = screen.getByRole("region", { name: "Entrega de Tienda B" });
      await userEvent.setup().click(within(section).getByRole("button", { name: "Quitar tienda" }));
      await ready();
      expect(screen.queryByText("Esta tienda no entrega en tu zona.")).not.toBeInTheDocument();
    });
  });
});
