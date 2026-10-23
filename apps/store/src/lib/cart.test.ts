import { beforeEach, describe, expect, it } from "vitest";
import {
  acceptPrices,
  addToCart,
  emptyCart,
  itemCount,
  MAX_LINES,
  MAX_STORES,
  parseCart,
  removeLine,
  removeStore,
  setQuantity,
  setStoreName,
  storeCount,
  storeGroup,
  storeGroups,
  toOrderItems,
  toQuoteItems,
} from "./cart";
import { CART_KEY, getCartSnapshot, LEGACY_CART_KEY, resetCartStoreForTests, setCart, updateCart } from "./cart-store";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const S3 = "33333333-3333-4333-8333-333333333333";
const S4 = "44444444-4444-4444-8444-444444444444";
const S5 = "55555555-5555-4555-8555-555555555555";
const v = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("addToCart", () => {
  it("agrega una línea con su tienda y suma si la variante ya está", () => {
    const first = addToCart(emptyCart, { storeId: S1, storeName: "Tienda A", variantId: v(1), quantity: 2, seenPrice: 10 });
    expect(first.status).toBe("added");
    const second = addToCart(first.cart, { storeId: S1, variantId: v(1), quantity: 3 });
    expect(second.cart.lines).toEqual([{ storeId: S1, storeName: "Tienda A", variantId: v(1), quantity: 5, seenPrice: 10 }]);
    expect(itemCount(second.cart)).toBe(5);
  });

  it("admite productos de varias tiendas en el mismo carrito", () => {
    let cart = addToCart(emptyCart, { storeId: S1, storeName: "Tienda A", variantId: v(1), quantity: 1 }).cart;
    const second = addToCart(cart, { storeId: S2, storeName: "Tienda B", variantId: v(2), quantity: 1 });
    expect(second.status).toBe("added");
    cart = second.cart;
    expect(storeCount(cart)).toBe(2);
    expect(cart.lines.map((l) => l.storeId)).toEqual([S1, S2]);
  });

  it(`topa las tiendas distintas en ${MAX_STORES} y deja el carrito intacto`, () => {
    let cart = emptyCart;
    [S1, S2, S3, S4].forEach((store, i) => (cart = addToCart(cart, { storeId: store, variantId: v(i + 1), quantity: 1 }).cart));
    const blocked = addToCart(cart, { storeId: S5, variantId: v(9), quantity: 1 });
    expect(blocked.status).toBe("too_many_stores");
    expect(blocked.cart).toBe(cart);
    // Otro producto de una tienda que ya está sí entra.
    expect(addToCart(cart, { storeId: S1, variantId: v(10), quantity: 1 }).status).toBe("added");
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

  it("topa las líneas distintas entre todas las tiendas", () => {
    let cart = emptyCart;
    for (let i = 1; i <= MAX_LINES; i++) cart = addToCart(cart, { storeId: i % 2 ? S1 : S2, variantId: v(i), quantity: 1 }).cart;
    expect(addToCart(cart, { storeId: S1, variantId: v(99), quantity: 1 }).status).toBe("full");
    expect(addToCart(cart, { storeId: S1, variantId: v(1), quantity: 1 }).status).toBe("added");
  });
});

describe("tiendas del carrito", () => {
  const cart = [
    { storeId: S1, storeName: "Tienda A", variantId: v(1), quantity: 2 },
    { storeId: S2, storeName: "Tienda B", variantId: v(2), quantity: 1 },
    { storeId: S1, storeName: "Tienda A", variantId: v(3), quantity: 4 },
  ].reduce((c, input) => addToCart(c, input).cart, emptyCart);

  it("agrupa por tienda en el orden en que se agregó la primera", () => {
    const groups = storeGroups(cart);
    expect(groups.map((g) => [g.storeId, g.storeName, g.lines.map((l) => l.variantId)])).toEqual([
      [S1, "Tienda A", [v(1), v(3)]],
      [S2, "Tienda B", [v(2)]],
    ]);
  });

  it("encuentra el grupo de una tienda o nada", () => {
    expect(storeGroup(cart, S2)?.lines).toHaveLength(1);
    expect(storeGroup(cart, S3)).toBeNull();
    expect(storeGroup(cart, null)).toBeNull();
  });

  it("quitar una tienda deja las demás, y la última vacía el carrito", () => {
    const rest = removeStore(cart, S1);
    expect(rest.lines.map((l) => l.variantId)).toEqual([v(2)]);
    expect(removeStore(rest, S2)).toBe(emptyCart);
    expect(removeStore(cart, S3)).toEqual(cart);
  });

  it("guarda el nombre vigente de una tienda en sus líneas", () => {
    const renamed = setStoreName(cart, S1, "Tienda A Centro");
    expect(storeGroup(renamed, S1)?.storeName).toBe("Tienda A Centro");
    expect(storeGroup(renamed, S2)?.storeName).toBe("Tienda B");
    expect(setStoreName(cart, S1, "Tienda A")).toBe(cart);
  });
});

describe("setQuantity / removeLine", () => {
  const cart = addToCart(addToCart(emptyCart, { storeId: S1, variantId: v(1), quantity: 2 }).cart, { storeId: S2, variantId: v(2), quantity: 1 }).cart;

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
  it("el pedido lleva solo variante y cantidad", () => {
    expect(toOrderItems(cart)).toEqual([{ variant_id: v(1), quantity: 2 }]);
  });
  it("una cotización por grupo solo lleva las líneas de esa tienda", () => {
    const two = addToCart(cart, { storeId: S2, variantId: v(2), quantity: 1 }).cart;
    expect(toOrderItems(storeGroup(two, S2)!)).toEqual([{ variant_id: v(2), quantity: 1 }]);
  });
  it("aceptar precios actualiza el precio visto", () => {
    expect(acceptPrices(cart, { [v(1)]: 12 }).lines[0]!.seenPrice).toBe(12);
  });
});

describe("parseCart", () => {
  it("descarta lo inválido y los duplicados", () => {
    expect(parseCart(null)).toBe(emptyCart);
    expect(parseCart({ lines: [] })).toBe(emptyCart);
    expect(parseCart({ lines: [{ storeId: "x", variantId: v(1), quantity: 1 }] })).toBe(emptyCart);
    expect(parseCart({ lines: [{ storeId: S1, variantId: v(1), quantity: 0 }] })).toBe(emptyCart);
    const dup = parseCart({ lines: [{ storeId: S1, variantId: v(1), quantity: 1 }, { storeId: S1, variantId: v(1), quantity: 4 }] });
    expect(dup.lines).toHaveLength(1);
  });

  it("migra el carrito de una sola tienda de la versión 1", () => {
    const migrated = parseCart({ storeId: S1, storeName: "Tienda A", lines: [{ variantId: v(1), quantity: 2, seenPrice: 10 }, { variantId: v(2), quantity: 1, seenPrice: null }] });
    expect(migrated.lines).toEqual([
      { storeId: S1, storeName: "Tienda A", variantId: v(1), quantity: 2, seenPrice: 10 },
      { storeId: S1, storeName: "Tienda A", variantId: v(2), quantity: 1, seenPrice: null },
    ]);
    expect(parseCart({ storeId: S1, lines: [] })).toBe(emptyCart);
    expect(parseCart({ storeId: null, lines: [{ variantId: v(1), quantity: 1 }] })).toBe(emptyCart);
    expect(parseCart({ storeId: "x", lines: [{ variantId: v(1), quantity: 1 }] })).toBe(emptyCart);
  });

  it(`conserva solo las primeras ${MAX_STORES} tiendas de un contenido manipulado`, () => {
    const lines = [S1, S2, S3, S4, S5].map((storeId, i) => ({ storeId, variantId: v(i + 1), quantity: 1 }));
    const parsed = parseCart({ lines });
    expect(storeCount(parsed)).toBe(MAX_STORES);
    expect(parsed.lines.some((l) => l.storeId === S5)).toBe(false);
  });
});

describe("almacén del carrito", () => {
  beforeEach(() => {
    localStorage.clear();
    resetCartStoreForTests();
  });

  it("guarda en localStorage y se recupera tras recargar", () => {
    updateCart((c) => addToCart(c, { storeId: S1, variantId: v(1), quantity: 2 }).cart);
    updateCart((c) => addToCart(c, { storeId: S2, variantId: v(2), quantity: 1 }).cart);
    expect(JSON.parse(localStorage.getItem(CART_KEY)!).lines).toHaveLength(2);
    resetCartStoreForTests();
    expect(getCartSnapshot().lines[0]!.quantity).toBe(2);
    expect(storeCount(getCartSnapshot())).toBe(2);
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

  it("migra un carrito guardado por la versión anterior y borra la clave vieja", () => {
    localStorage.setItem(LEGACY_CART_KEY, JSON.stringify({ storeId: S1, storeName: "Tienda A", lines: [{ variantId: v(1), quantity: 3, seenPrice: 9 }] }));
    const cart = getCartSnapshot();
    expect(cart.lines).toEqual([{ storeId: S1, storeName: "Tienda A", variantId: v(1), quantity: 3, seenPrice: 9 }]);
    expect(localStorage.getItem(LEGACY_CART_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(CART_KEY)!).lines).toHaveLength(1);
  });

  it("si hay carrito nuevo, no toca el viejo para pisarlo", () => {
    updateCart((c) => addToCart(c, { storeId: S2, variantId: v(2), quantity: 1 }).cart);
    resetCartStoreForTests();
    localStorage.setItem(LEGACY_CART_KEY, JSON.stringify({ storeId: S1, lines: [{ variantId: v(1), quantity: 1 }] }));
    expect(getCartSnapshot().lines[0]!.storeId).toBe(S2);
  });
});
