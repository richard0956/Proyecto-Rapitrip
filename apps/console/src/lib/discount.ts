/** Un precio nuevo cuenta como descuento si baja al menos 5 % respecto del precio de lista. Misma regla que `update_variant`. */
export const MIN_DISCOUNT_PERCENT = 5;

export type VariantPrice = { price: number; compareAt: number | null };
export type DiscountResult = { compareAt: number | null; pct: number };

const cents = (value: number) => Math.round(value * 100);

/** Porcentaje de descuento entre un precio de lista y el precio actual (0 si no hay). */
export function discountPercent(price: number, compareAt: number | null): number {
  if (compareAt === null || cents(compareAt) <= cents(price)) return 0;
  return Math.round(((cents(compareAt) - cents(price)) / cents(compareAt)) * 100);
}

/**
 * Qué pasa con el descuento de una variante si se guarda este precio nuevo: la lista de referencia es el precio anterior de un
 * descuento vigente o, si no hay, el precio actual. Sirve para avisar al comercio antes de guardar; la base de datos decide.
 */
export function discountAfterChange(current: VariantPrice, newPrice: number): DiscountResult {
  const list = cents(current.compareAt ?? current.price);
  const next = cents(newPrice);
  if (list <= 0 || next * 100 > list * (100 - MIN_DISCOUNT_PERCENT)) return { compareAt: null, pct: 0 };
  const compareAt = list / 100;
  return { compareAt, pct: discountPercent(newPrice, compareAt) };
}
