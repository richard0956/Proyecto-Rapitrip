import { z } from "zod";

/** Carrito del navegador: de una sola tienda (decisión D1) y solo con identificadores y cantidades. Los precios se cotizan siempre en el servidor. */
export const MAX_QUANTITY = 99;
export const MAX_LINES = 30;

export type CartLine = {
  variantId: string;
  quantity: number;
  /** Último precio que vio el cliente. No se cobra nunca: solo sirve para avisar «el precio cambió». */
  seenPrice: number | null;
};

export type Cart = { storeId: string | null; storeName: string | null; lines: CartLine[] };

export const emptyCart: Cart = { storeId: null, storeName: null, lines: [] };

const cartSchema = z.object({
  storeId: z.string().uuid().nullable(),
  storeName: z.string().max(120).nullable().default(null),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY),
        seenPrice: z.number().min(0).nullable().default(null),
      }),
    )
    .max(MAX_LINES),
});

/** Lee lo que haya guardado; cualquier cosa rara (versión vieja, edición a mano) se descarta y empieza vacío. */
export function parseCart(raw: unknown): Cart {
  const parsed = cartSchema.safeParse(raw);
  if (!parsed.success) return emptyCart;
  const { storeId, storeName, lines } = parsed.data;
  if (!storeId || lines.length === 0) return emptyCart;
  const seen = new Set<string>();
  const unique = lines.filter((line) => (seen.has(line.variantId) ? false : (seen.add(line.variantId), true)));
  return { storeId, storeName, lines: unique };
}

export type AddInput = {
  storeId: string;
  storeName?: string | null;
  variantId: string;
  quantity: number;
  seenPrice?: number | null;
  /** Máximo comprable según el catálogo (nulo si no hay control de stock). */
  maxPerOrder?: number | null;
};

export type AddResult =
  | { status: "added"; cart: Cart }
  /** Se agregó, pero la cantidad quedó recortada por el tope (99 o el stock). */
  | { status: "capped"; cart: Cart }
  /** El carrito ya es de otra tienda: no se toca hasta que el cliente decida vaciarlo. */
  | { status: "store_conflict"; cart: Cart }
  | { status: "full"; cart: Cart }
  | { status: "invalid"; cart: Cart };

function limitFor(maxPerOrder: number | null | undefined): number {
  return maxPerOrder == null ? MAX_QUANTITY : Math.max(0, Math.min(MAX_QUANTITY, maxPerOrder));
}

export function addToCart(cart: Cart, input: AddInput, options: { replaceOtherStore?: boolean } = {}): AddResult {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return { status: "invalid", cart };
  const limit = limitFor(input.maxPerOrder);
  if (limit < 1) return { status: "invalid", cart };

  let base = cart;
  if (cart.storeId !== null && cart.storeId !== input.storeId) {
    if (!options.replaceOtherStore) return { status: "store_conflict", cart };
    base = emptyCart;
  }

  const existing = base.lines.find((line) => line.variantId === input.variantId);
  if (!existing && base.lines.length >= MAX_LINES) return { status: "full", cart };

  const wanted = (existing?.quantity ?? 0) + input.quantity;
  const quantity = Math.min(wanted, limit);
  const line: CartLine = { variantId: input.variantId, quantity, seenPrice: input.seenPrice ?? existing?.seenPrice ?? null };
  const lines = existing ? base.lines.map((l) => (l.variantId === input.variantId ? line : l)) : [...base.lines, line];
  return {
    status: quantity < wanted ? "capped" : "added",
    cart: { storeId: input.storeId, storeName: input.storeName ?? base.storeName, lines },
  };
}

/** Cambia la cantidad de una línea. Cero o menos la quita. */
export function setQuantity(cart: Cart, variantId: string, quantity: number, maxPerOrder?: number | null): Cart {
  if (!Number.isInteger(quantity) || quantity < 1) return removeLine(cart, variantId);
  const limit = Math.max(1, limitFor(maxPerOrder));
  return normalize({
    ...cart,
    lines: cart.lines.map((line) => (line.variantId === variantId ? { ...line, quantity: Math.min(quantity, limit) } : line)),
  });
}

export function removeLine(cart: Cart, variantId: string): Cart {
  return normalize({ ...cart, lines: cart.lines.filter((line) => line.variantId !== variantId) });
}

/** Actualiza el precio visto de las líneas, tras aceptar el cliente los cambios de una cotización. */
export function acceptPrices(cart: Cart, prices: Record<string, number>): Cart {
  return { ...cart, lines: cart.lines.map((line) => (line.variantId in prices ? { ...line, seenPrice: prices[line.variantId]! } : line)) };
}

export function setStoreName(cart: Cart, name: string): Cart {
  return cart.storeId && cart.storeName !== name ? { ...cart, storeName: name } : cart;
}

function normalize(cart: Cart): Cart {
  return cart.lines.length === 0 ? emptyCart : cart;
}

export function itemCount(cart: Cart): number {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Lo que se manda a `quote_cart`: identificadores, cantidades y el precio visto (solo para avisar cambios). */
export function toQuoteItems(cart: Cart): { variant_id: string; quantity: number; seen_price?: number }[] {
  return cart.lines.map((line) => ({
    variant_id: line.variantId,
    quantity: line.quantity,
    ...(line.seenPrice !== null ? { seen_price: line.seenPrice } : {}),
  }));
}

/** Lo que se manda a `create_order`: sin precios, la base usa los vigentes. */
export function toOrderItems(cart: Cart): { variant_id: string; quantity: number }[] {
  return cart.lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity }));
}
