import type { Cart } from "./cart";
import { removeLine, setQuantity } from "./cart";
import type { Quote, QuoteProblem } from "./catalog";
import { formatMoney } from "./money";

/** Problemas que impiden pagar. «Precio cambiado» solo exige que el cliente lo acepte. */
const blocking = new Set<QuoteProblem["code"]>(["tienda_no_disponible", "tienda_cerrada", "producto_no_disponible", "sin_stock", "cantidad_invalida"]);

export const isBlocking = (problem: QuoteProblem) => blocking.has(problem.code);

export function problemMessage(problem: QuoteProblem, quote: Quote | null): string {
  const name = problem.product_name ?? quote?.lines.find((l) => l.variant_id === problem.variant_id)?.product_name ?? "Un producto";
  switch (problem.code) {
    case "tienda_no_disponible":
      return "Esta tienda ya no está disponible.";
    case "tienda_cerrada":
      return "La tienda está cerrada en este momento: puedes guardar tu carrito y pedir cuando abra.";
    case "producto_no_disponible":
      return "Un producto de tu carrito ya no está disponible.";
    case "sin_stock":
      return problem.max_per_order && problem.max_per_order > 0
        ? `De «${name}» solo quedan ${problem.max_per_order}.`
        : `«${name}» se agotó.`;
    case "precio_cambiado":
      return `El precio de «${name}» cambió de ${formatMoney(problem.old_price)} a ${formatMoney(problem.new_price)}.`;
    case "cantidad_invalida":
      return "Hay una cantidad inválida en tu carrito.";
  }
}

export const hasBlocking = (quote: Quote | null) => !!quote && quote.problems.some(isBlocking);

/** Aplica al carrito lo que el cliente aceptó: quita lo que ya no existe y baja cantidades al stock disponible. */
export function resolveProblems(cart: Cart, problems: QuoteProblem[]): Cart {
  let next = cart;
  for (const problem of problems) {
    if (!problem.variant_id) continue;
    if (problem.code === "producto_no_disponible" || problem.code === "cantidad_invalida") next = removeLine(next, problem.variant_id);
    else if (problem.code === "sin_stock") next = problem.max_per_order && problem.max_per_order > 0 ? setQuantity(next, problem.variant_id, problem.max_per_order, problem.max_per_order) : removeLine(next, problem.variant_id);
  }
  return next;
}

/** Precios nuevos de las líneas con «precio cambiado», para que el carrito deje de avisar tras aceptarlos. */
export function changedPrices(problems: QuoteProblem[]): Record<string, number> {
  const prices: Record<string, number> = {};
  for (const problem of problems) if (problem.code === "precio_cambiado" && problem.variant_id && problem.new_price !== undefined) prices[problem.variant_id] = problem.new_price;
  return prices;
}
