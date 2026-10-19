import { beforeEach, describe, expect, it } from "vitest";
import { acceptPrices, addToCart, emptyCart, itemCount, MAX_LINES, parseCart, removeLine, setQuantity, toOrderItems, toQuoteItems } from "./cart";
import { CART_KEY, getCartSnapshot, resetCartStoreForTests, setCart, updateCart } from "./cart-store";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const v = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("addToCart", () => {
  it("agrega una línea y suma si la variante ya está", () => {
    const first = addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 2, seenPrice: 10 });
    expect(first.status).toBe("added");
    const second = addToCart(first.cart, { storeId: S1, variantId: v(1), quantity: 3 });
    expect(second.cart.lines).toEqual([{ variantId: v(1), quantity: 5, seenPrice: 10 }]);
    expect(itemCount(second.cart)).toBe(5);
  });

  it("no mezcla tiendas: avisa y deja el carrito intacto hasta que el cliente decida", () => {
    const first = addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 1 }).cart;
    const conflict = addToCart(first, { storeId: S2, variantId: v(2), quantity: 1 });
    expect(conflict.status).toBe("store_conflict");
    expect(conflict.cart).toBe(first);
    const replaced = addToCart(first, { storeId: S2, variantId: v(2), quantity: 1 }, { replaceOtherStore: true });
    expect(replaced.cart.storeId).toBe(S2);
    expect(replaced.cart.lines).toHaveLength(1);
  });

  it("recorta a 99 y al máximo comprable según el stock", () => {
    const big = addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 150 });
    expect(big.status).toBe("capped");
    expect(big.cart.lines[0]!.quantity).toBe(99);
    const stock = addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 5, maxPerOrder: 3 });
    expect(stock.status).toBe("capped");
    expect(stock.cart.lines[0]!.quantity).toBe(3);
  });

  it("rechaza cantidades inválidas y variantes sin stock", () => {
    expect(addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 0 }).status).toBe("invalid");
    expect(addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 1.5 }).status).toBe("invalid");
    expect(addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 1, maxPerOrder: 0 }).status).toBe("invalid");
  });

  it("topa las líneas distintas", () => {
    let cart = emptyCart;
    for (let i = 1; i <= MAX_LINES; i++) cart = addToCart(cart, { storeId: S1, variantId: v(i), quantity: 1 }).cart;
    expect(addToCart(cart, { storeId: S1, variantId: v(99), quantity: 1 }).status).toBe("full");
    expect(addToCart(cart, { storeId: S1, variantId: v(1), quantity: 1 }).status).toBe("added");
  });
});

describe("setQuantity / removeLine", () => {
  const cart = addToCart(addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 2 }).cart, { storeId: S1, variantId: v(2), quantity: 1 }).cart;

  it("cambia la cantidad dentro de los topes", () => {
    expect(setQuantity(cart, v(1), 7).lines[0]!.quantity).toBe(7);
    expect(setQuantity(cart, v(1), 500).lines[0]!.quantity).toBe(99);
    expect(setQuantity(cart, v(1), 9, 4).lines[0]!.quantity).toBe(4);
  });

  it("cantidad cero o inválida quita la línea, y el último quitado vacía el carrito", () => {
    expect(setQuantity(cart, v(1), 0).lines.map((l) => l.variantId)).toEqual([v(2)]);
    expect(removeLine(removeLine(cart, v(1)), v(2))).toBe(emptyCart);
  });
});

describe("cotización y pedido", () => {
  const cart = addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 2, seenPrice: 10.5 }).cart;
  it("la cotización lleva el precio visto solo para avisar cambios", () => {
    expect(toQuoteItems(cart)).toEqual([{ variant_id: v(1), quantity: 2, seen_price: 10.5 }]);
  });
  it("el pedido nunca lleva precios", () => {
    expect(toOrderItems(cart)).toEqual([{ variant_id: v(1), quantity: 2 }]);
  });
  it("aceptar los precios actualiza el precio visto", () => {
    expect(acceptPrices(cart, { [v(1)]: 12 }).lines[0]!.seenPrice).toBe(12);
  });
});

describe("parseCart", () => {
  it("descarta lo inválido y los duplicados", () => {
    expect(parseCart(null)).toBe(emptyCart);
    expect(parseCart({ storeId: "x", lines: [] })).toBe(emptyCart);
    expect(parseCart({ storeId: S1, lines: [{ variantId: v(1), quantity: 0 }] })).toBe(emptyCart);
    const dup = parseCart({ storeId: S1, lines: [{ variantId: v(1), quantity: 1 }, { variantId: v(1), quantity: 4 }] });
    expect(dup.lines).toHaveLength(1);
  });
});

describe("almacén del carrito", () => {
  beforeEach(() => {
    localStorage.clear();
    resetCartStoreForTests();
  });

  it("guarda en localStorage y se recupera tras recargar", () => {
    updateCart((c) => addToCart(c, { storeId: S1, variantId: v(1), quantity: 2 }).cart);
    expect(JSON.parse(localStorage.getItem(CART_KEY)!).lines).toHaveLength(1);
    resetCartStoreForTests();
    expect(getCartSnapshot().lines[0]!.quantity).toBe(2);
  });

  it("vaciar borra la clave", () => {
    updateCart((c) => addToCart(c, { storeId: S1, variantId: v(1), quantity: 1 }).cart);
    setCart(emptyCart);
    expect(localStorage.getItem(CART_KEY)).toBeNull();
  });

  it("ignora contenido corrupto", () => {
    localStorage.setItem(CART_KEY, "{no es json");
    expect(getCartSnapshot()).toBe(emptyCart);
  });
});
