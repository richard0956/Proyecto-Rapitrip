import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { getCartSnapshot, resetCartStoreForTests } from "@/lib/cart-store";
import { AddToCart } from "./add-to-cart";

const STORE = "11111111-1111-4111-8111-111111111111";
const V1 = "00000000-0000-4000-8000-000000000001";
const V2 = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  localStorage.clear();
  resetCartStoreForTests();
});

describe("AddToCart", () => {
  it("agrega la variante elegida con su cantidad y recuerda el precio visto", async () => {
    render(<AddToCart storeId={STORE} storeName="Tienda A" storeOpen variants={[{ id: V1, name: "500 g", price: 100, available: true, max_per_order: null }, { id: V2, name: "1 kg", price: 180, available: true, max_per_order: null }]} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/1 kg/));
    await user.click(screen.getByRole("button", { name: "Más" }));
    await user.click(screen.getByRole("button", { name: /Agregar al carrito/ }));
    expect(getCartSnapshot().lines).toEqual([{ variantId: V2, quantity: 2, seenPrice: 180 }]);
    expect(await screen.findByText(/Agregado al carrito/)).toBeInTheDocument();
  });

  it("no deja pedir más de lo que hay", async () => {
    render(<AddToCart storeId={STORE} storeName="Tienda A" storeOpen variants={[{ id: V1, name: "500 g", price: 100, available: true, max_per_order: 2 }]} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Más" }));
    expect(screen.getByRole("button", { name: "Más" })).toBeDisabled();
    expect(screen.getByText(/Quedan pocas unidades/)).toBeInTheDocument();
  });

  it("con la tienda cerrada o la variante agotada no se puede agregar", () => {
    const { rerender } = render(<AddToCart storeId={STORE} storeName="Tienda A" storeOpen={false} variants={[{ id: V1, name: "u", price: 10, available: true, max_per_order: null }]} />);
    expect(screen.getByRole("button", { name: /Agregar al carrito/ })).toBeDisabled();
    expect(screen.getByText(/tienda está cerrada/)).toBeInTheDocument();
    rerender(<AddToCart storeId={STORE} storeName="Tienda A" storeOpen variants={[{ id: V1, name: "u", price: 10, available: false, max_per_order: 0 }]} />);
    expect(screen.getByRole("button", { name: /Agregar al carrito/ })).toBeDisabled();
    expect(screen.getByText(/está agotada/)).toBeInTheDocument();
  });
});
