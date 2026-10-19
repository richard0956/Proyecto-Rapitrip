"use server";

import { cartLineSchema } from "@rapitrip/validation";
import { z } from "zod";
import { quoteCart, type Quote } from "@/lib/catalog";

const schema = z.object({
  storeId: z.string().uuid(),
  items: z.array(cartLineSchema.extend({ seen_price: z.number().min(0).optional() })).min(1).max(30),
});

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string };

/** Cotiza el carrito con precios, stock y envío de ahora. No pide sesión: el visitante revisa su carrito antes de ingresar. */
export async function quoteCartAction(input: unknown): Promise<QuoteResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tu carrito tiene datos inválidos." };
  try {
    return { ok: true, quote: await quoteCart(parsed.data.storeId, parsed.data.items) };
  } catch (error) {
    console.error("[carrito] cotizar", error);
    return { ok: false, error: "No pudimos actualizar los precios. Inténtalo de nuevo." };
  }
}
