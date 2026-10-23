import { describe, expect, it } from "vitest";
import { addToCart, emptyCart } from "./cart";
import type { QuoteProblem } from "./catalog";
import { changedPrices, hasBlocking, isBlocking, problemMessage, resolveProblems } from "./quote-problems";

const S = "11111111-1111-4111-8111-111111111111";
const V1 = "00000000-0000-4000-8000-000000000001";
const V2 = "00000000-0000-4000-8000-000000000002";
const cart = addToCart(addToCart(emptyCart, { storeId: S, variantId: V1, quantity: 5 }).cart, { storeId: S, variantId: V2, quantity: 2 }).cart;

describe("quote-problems", () => {
  it("solo el cambio de precio no bloquea el pago", () => {
    expect(isBlocking({ code: "precio_cambiado" })).toBe(false);
    expect(isBlocking({ code: "sin_stock" })).toBe(true);
    expect(isBlocking({ code: "tienda_cerrada" })).toBe(true);
    expect(hasBlocking({ store: null, lines: [], subtotal: 0, delivery_fee: 0, total: 0, problems: [{ code: "precio_cambiado" }] })).toBe(false);
    expect(hasBlocking(null)).toBe(false);
  });

  it("redacta mensajes humanos", () => {
    expect(problemMessage({ code: "sin_stock", product_name: "Café", max_per_order: 3 }, null)).toBe("De «Café» solo quedan 3.");
    expect(problemMessage({ code: "sin_stock", product_name: "Café", max_per_order: 0 }, null)).toBe("«Café» se agotó.");
    expect(problemMessage({ code: "precio_cambiado", product_name: "Pan", old_price: 10, new_price: 12 }, null)).toMatch(/«Pan» cambió de .*10.* a .*12/);
  });

  it("resolver quita lo que no existe y baja cantidades al stock", () => {
    const problems: QuoteProblem[] = [
      { code: "sin_stock", variant_id: V1, max_per_order: 3 },
      { code: "producto_no_disponible", variant_id: V2 },
    ];
    const next = resolveProblems(cart, problems);
    expect(next.lines).toEqual([{ storeId: S, storeName: null, variantId: V1, quantity: 3, seenPrice: null }]);
  });

  it("una variante agotada (máximo 0) se quita", () => {
    expect(resolveProblems(cart, [{ code: "sin_stock", variant_id: V1, max_per_order: 0 }]).lines.map((l) => l.variantId)).toEqual([V2]);
  });

  it("junta los precios nuevos", () => {
    expect(changedPrices([{ code: "precio_cambiado", variant_id: V1, new_price: 12 }, { code: "sin_stock", variant_id: V2 }])).toEqual({ [V1]: 12 });
  });
});
