import { z } from "zod";

/**
 * Carrito del navegador, de varias tiendas (versión 2): solo con identificadores y cantidades; cada línea recuerda su tienda.
 * Los precios se cotizan siempre en el servidor. Una compra se divide después en pedidos por tienda y por clase de entrega.
 */
export const MAX_QUANTITY = 99;
/** Líneas distintas en total, entre todas las tiendas (también es el tope de un pedido). */
export const MAX_LINES = 30;
/** Tiendas distintas en una misma compra. */
export const MAX_STORES = 4;

export type CartLine = {
  storeId: string;
  /** Nombre de la tienda tal como se vio al agregar; solo para mostrarlo mientras se cotiza. */
  storeName: string | null;
  variantId: string;
  quantity: number;
  /** Último precio que vio el cliente. No se cobra nunca: solo sirve para avisar «el precio cambió». */
  seenPrice: number | null;
};

export type Cart = { lines: CartLine[] };

export const emptyCart: Cart = { lines: [] };

/** Las líneas de una tienda, en el orden en que se agregaron. */
export type StoreGroup = { storeId: string; storeName: string | null; lines: CartLine[] };

const lineSchema = z.object({
  storeId: z.string().uuid(),
  storeName: z.string().max(120).nullable().default(null),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  seenPrice: z.number().min(0).nullable().default(null),
});
const cartSchema = z.object({ lines: z.array(lineSchema).max(MAX_LINES) });

/** Forma anterior (versión 1): una sola tienda para todo el carrito. */
const legacySchema = z.object({
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

/**
 * Lee lo que haya guardado. Acepta la versión 2 y migra la versión 1 (le pone su tienda a cada línea); cualquier cosa rara
 * (edición a mano, versión desconocida) se descarta y empieza vacío. Sin líneas repetidas ni más de MAX_STORES tiendas.
 */
export function parseCart(raw: unknown): Cart {
  let lines: CartLine[] | null = null;
  const current = cartSchema.safeParse(raw);
  if (current.success && !(typeof raw === "object" && raw !== null && "storeId" in raw)) lines = current.data.lines;
  else {
    const legacy = legacySchema.safeParse(raw);
    if (legacy.success && legacy.data.storeId) {
      const { storeId, storeName } = legacy.data;
      lines = legacy.data.lines.map((line) => ({ ...line, storeId, storeName }));
    }
  }
  if (!lines || lines.length === 0) return emptyCart;
  const seen = new Set<string>();
  const stores: string[] = [];
  const kept: CartLine[] = [];
  for (const line of lines) {
    if (seen.has(line.variantId)) continue;
    if (!stores.includes(line.storeId)) {
      if (stores.length >= MAX_STORES) continue;
      stores.push(line.storeId);
    }
    seen.add(line.variantId);
    kept.push(line);
  }
  return kept.length === 0 ? emptyCart : { lines: kept };
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
  /** La compra ya tiene MAX_STORES tiendas distintas: no se toca hasta que el cliente quite una. */
  | { status: "too_many_stores"; cart: Cart }
  | { status: "full"; cart: Cart }
  | { status: "invalid"; cart: Cart };

function limitFor(maxPerOrder: number | null | undefined): number {
  return maxPerOrder == null ? MAX_QUANTITY : Math.max(0, Math.min(MAX_QUANTITY, maxPerOrder));
}

export function addToCart(cart: Cart, input: AddInput): AddResult {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return { status: "invalid", cart };
  const limit = limitFor(input.maxPerOrder);
  if (limit < 1) return { status: "invalid", cart };

  const existing = cart.lines.find((line) => line.variantId === input.variantId);
  if (!existing) {
    if (cart.lines.length >= MAX_LINES) return { status: "full", cart };
    if (!cart.lines.some((line) => line.storeId === input.storeId) && storeCount(cart) >= MAX_STORES) return { status: "too_many_stores", cart };
  }

  const wanted = (existing?.quantity ?? 0) + input.quantity;
  const quantity = Math.min(wanted, limit);
  const line: CartLine = {
    storeId: input.storeId,
    storeName: input.storeName ?? existing?.storeName ?? cart.lines.find((l) => l.storeId === input.storeId)?.storeName ?? null,
    variantId: input.variantId,
    quantity,
    seenPrice: input.seenPrice ?? existing?.seenPrice ?? null,
  };
  const lines = existing ? cart.lines.map((l) => (l.variantId === input.variantId ? line : l)) : [...cart.lines, line];
  return { status: quantity < wanted ? "capped" : "added", cart: { lines } };
}

/** Cambia la cantidad de una línea. Cero o menos la quita. */
export function setQuantity(cart: Cart, variantId: string, quantity: number, maxPerOrder?: number | null): Cart {
  if (!Number.isInteger(quantity) || quantity < 1) return removeLine(cart, variantId);
  const limit = Math.max(1, limitFor(maxPerOrder));
  return normalize({
    lines: cart.lines.map((line) => (line.variantId === variantId ? { ...line, quantity: Math.min(quantity, limit) } : line)),
  });
}

export function removeLine(cart: Cart, variantId: string): Cart {
  return normalize({ lines: cart.lines.filter((line) => line.variantId !== variantId) });
}

/** Quita todas las líneas de una tienda (por ejemplo, cuando ya se hizo su pedido). */
export function removeStore(cart: Cart, storeId: string): Cart {
  return normalize({ lines: cart.lines.filter((line) => line.storeId !== storeId) });
}

/** Actualiza el precio visto de las líneas, tras aceptar el cliente los cambios de una cotización. */
export function acceptPrices(cart: Cart, prices: Record<string, number>): Cart {
  return { lines: cart.lines.map((line) => (line.variantId in prices ? { ...line, seenPrice: prices[line.variantId]! } : line)) };
}

/** Guarda el nombre vigente de una tienda en sus líneas. Devuelve el mismo carrito si ya coincide. */
export function setStoreName(cart: Cart, storeId: string, name: string): Cart {
  if (!cart.lines.some((line) => line.storeId === storeId && line.storeName !== name)) return cart;
  return { lines: cart.lines.map((line) => (line.storeId === storeId ? { ...line, storeName: name } : line)) };
}

function normalize(cart: Cart): Cart {
  return cart.lines.length === 0 ? emptyCart : cart;
}

export function itemCount(cart: Pick<Cart, "lines">): number {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function storeCount(cart: Cart): number {
  return new Set(cart.lines.map((line) => line.storeId)).size;
}

/** Las tiendas del carrito, en el orden en que se agregó su primer producto. */
export function storeGroups(cart: Cart): StoreGroup[] {
  const groups = new Map<string, StoreGroup>();
  for (const line of cart.lines) {
    const group = groups.get(line.storeId);
    if (group) {
      group.lines.push(line);
      group.storeName ??= line.storeName;
    } else groups.set(line.storeId, { storeId: line.storeId, storeName: line.storeName, lines: [line] });
  }
  return [...groups.values()];
}

/** El grupo de una tienda; vacío si el carrito ya no tiene productos de ella. */
export function storeGroup(cart: Cart, storeId: string | null): StoreGroup | null {
  return storeId ? (storeGroups(cart).find((group) => group.storeId === storeId) ?? null) : null;
}

/** Lo que se manda a `quote_cart`: identificadores, cantidades y el precio visto (solo para avisar cambios). */
export function toQuoteItems(cart: Pick<Cart, "lines">): { variant_id: string; quantity: number; seen_price?: number }[] {
  return cart.lines.map((line) => ({
    variant_id: line.variantId,
    quantity: line.quantity,
    ...(line.seenPrice !== null ? { seen_price: line.seenPrice } : {}),
  }));
}

/** Lo que se manda a `create_order`: sin precios, la base usa los vigentes. */
export function toOrderItems(cart: Pick<Cart, "lines">): { variant_id: string; quantity: number }[] {
  return cart.lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity }));
}
