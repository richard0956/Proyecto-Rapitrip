import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }));

import { addToCart, emptyCart } from "@/lib/cart";
import { CART_KEY, resetCartStoreForTests, setCart } from "@/lib/cart-store";
import type { Quote } from "@/lib/catalog";
import { CheckoutForm } from "./checkout-form";

const STORE = "11111111-1111-4111-8111-111111111111";
const VARIANT = "00000000-0000-4000-8000-000000000001";

const quote: Quote = {
  store: { id: STORE, name: "Tienda A", open_now: true },
  lines: [{ variant_id: VARIANT, product_id: "p", product_name: "Café", variant_name: "500 g", cover_path: null, unit_price: 100, quantity: 2, line_total: 200, available: true, max_per_order: null }],
  subtotal: 200,
  delivery_fee: 25,
  total: 225,
  problems: [],
};

const quoteAction = vi.fn().mockResolvedValue({ ok: true, quote });

beforeEach(() => {
  vi.clearAllMocks();
  quoteAction.mockResolvedValue({ ok: true, quote });
  localStorage.clear();
  sessionStorage.clear();
  resetCartStoreForTests();
  setCart(addToCart(emptyCart, { storeId: STORE, storeName: "Tienda A", variantId: VARIANT, quantity: 2, seenPrice: 100 }).cart);
});

const saved = [{ id: "a1", label: "Casa", address: "Barrio Central, casa 4", phone: "88881111", is_default: true }];

describe("CheckoutForm", () => {
  it("con el carrito vacío invita a explorar las tiendas", async () => {
    setCart(emptyCart);
    render(<CheckoutForm addresses={[]} profilePhone="" quoteAction={quoteAction} placeOrder={vi.fn()} />);
    expect(await screen.findByText("Tu carrito está vacío")).toBeInTheDocument();
  });

  it("usa la dirección predeterminada y el teléfono guardado, y manda el pedido sin precios", async () => {
    const placeOrder = vi.fn().mockResolvedValue({ ok: true, orderId: "o1", payUrl: null });
    render(<CheckoutForm addresses={saved} profilePhone="" quoteAction={quoteAction} placeOrder={placeOrder} />);
    const confirm = await screen.findByRole("button", { name: "Confirmar pedido" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.setup().click(confirm);
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(1));
    const sent = placeOrder.mock.calls[0]![0];
    expect(sent).toMatchObject({ store_id: STORE, payment_method: "efectivo", address: "Barrio Central, casa 4", phone: "88881111" });
    expect(sent.items).toEqual([{ variant_id: VARIANT, quantity: 2 }]);
    expect(sent.client_ref).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pedidos/o1"));
    expect(localStorage.getItem(CART_KEY)).toBeNull();
  });

  it("un doble clic no envía dos pedidos", async () => {
    let finish: (value: unknown) => void = () => {};
    const placeOrder = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<CheckoutForm addresses={saved} profilePhone="" quoteAction={quoteAction} placeOrder={placeOrder} />);
    const confirm = await screen.findByRole("button", { name: "Confirmar pedido" });
    await waitFor(() => expect(confirm).toBeEnabled());
    const user = userEvent.setup();
    await user.dblClick(confirm);
    expect(placeOrder).toHaveBeenCalledTimes(1);
    finish({ ok: true, orderId: "o1", payUrl: null });
  });

  it("exige una dirección escrita cuando no hay guardadas", async () => {
    const placeOrder = vi.fn();
    render(<CheckoutForm addresses={[]} profilePhone="88881111" quoteAction={quoteAction} placeOrder={placeOrder} />);
    const confirm = await screen.findByRole("button", { name: "Confirmar pedido" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.setup().click(confirm);
    expect(await screen.findByRole("alert")).toHaveTextContent("Escribe la dirección de entrega");
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("con la sesión vencida guarda un borrador y lleva a ingresar", async () => {
    const placeOrder = vi.fn().mockResolvedValue({ ok: false, error: "Tu sesión venció.", expired: true });
    render(<CheckoutForm addresses={saved} profilePhone="" quoteAction={quoteAction} placeOrder={placeOrder} />);
    const confirm = await screen.findByRole("button", { name: "Confirmar pedido" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await userEvent.setup().click(confirm);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ingresar?next=%2Fcheckout&expirada=1"));
    expect(JSON.parse(sessionStorage.getItem("rapitrip:checkout") ?? "{}")).toMatchObject({ addressId: "a1", method: "efectivo" });
    // El carrito se conserva para cuando vuelva.
    expect(localStorage.getItem(CART_KEY)).not.toBeNull();
  });

  it("no deja pagar mientras haya un cambio de precio sin aceptar", async () => {
    quoteAction.mockResolvedValue({ ok: true, quote: { ...quote, problems: [{ code: "precio_cambiado", variant_id: VARIANT, product_name: "Café", old_price: 90, new_price: 100 }] } });
    render(<CheckoutForm addresses={saved} profilePhone="" quoteAction={quoteAction} placeOrder={vi.fn()} />);
    expect(await screen.findByText(/cambió de/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar pedido" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Aceptar los nuevos precios" })).toBeInTheDocument();
  });
});
