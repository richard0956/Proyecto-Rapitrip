"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { addToCart, MAX_QUANTITY, MAX_STORES, removeLine, setQuantity } from "@/lib/cart";
import { updateCart } from "@/lib/cart-store";
import type { CatalogProduct } from "@/lib/catalog";
import { useCart } from "@/lib/use-cart";

/**
 * Píldora «+ Agregar» de la tarjeta: agrega 1 unidad de la presentación más barata disponible. Cuando el producto ya está en el
 * carrito se convierte en un contador (− cantidad +); bajar de 1 lo quita. Solo se usa cuando el producto tiene una única
 * presentación; con varias, la tarjeta lleva a la ficha para elegir. El carrito admite varias tiendas (hasta MAX_STORES); la
 * compra se divide después en un pedido por tienda.
 */
export function QuickAdd({ product }: { product: CatalogProduct }) {
  const [message, setMessage] = useState("");
  const quantity = useCart().lines.find((line) => line.variantId === product.quick_variant_id)?.quantity ?? 0;
  const max = Math.min(product.quick_max ?? MAX_QUANTITY, MAX_QUANTITY);

  function add() {
    let status = "";
    updateCart((current) => {
      const result = addToCart(current, { storeId: product.store_id, storeName: product.store_name, variantId: product.quick_variant_id, quantity: 1, seenPrice: product.min_price, maxPerOrder: product.quick_max });
      status = result.status;
      return result.cart;
    });
    if (status === "too_many_stores") setMessage(`Una compra admite hasta ${MAX_STORES} tiendas. Quita una de tu carrito para agregar productos de ${product.store_name}.`);
    else if (status === "full") setMessage("Tu carrito ya tiene el máximo de productos distintos.");
    else if (status === "invalid") setMessage("No se pudo agregar este producto.");
    else setMessage(`${product.name} agregado al carrito.`);
  }

  function change(next: number) {
    updateCart((current) => (next <= 0 ? removeLine(current, product.quick_variant_id) : setQuantity(current, product.quick_variant_id, next, product.quick_max)));
    setMessage(next <= 0 ? `${product.name} quitado del carrito.` : `${product.name}: ${next} en el carrito.`);
  }

  const status = (
    <span role="status" className="sr-only">
      {message}
    </span>
  );

  if (quantity === 0) {
    return (
      <>
        <button
          type="button"
          onClick={add}
          aria-label={`Agregar ${product.name} al carrito`}
          className="relative z-10 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-crema px-4 text-[13px] font-bold text-tinta shadow-[0_6px_14px_-8px_rgb(6_54_42/0.35)] ring-1 ring-selva/[0.06] transition-[background-color,transform] duration-500 ease-fluido hover:bg-menta active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={2.5} />
          Agregar
        </button>
        {status}
      </>
    );
  }

  const step = "flex size-8 items-center justify-center rounded-full ring-1 ring-sobre-acento/40 transition-colors duration-300 hover:bg-sobre-acento/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sobre-acento disabled:opacity-40";
  return (
    <>
      <div className="relative z-10 flex min-h-10 w-full max-w-[164px] items-center justify-between rounded-full bg-selva px-1 text-sobre-acento shadow-pulsa">
        <button type="button" onClick={() => change(quantity - 1)} aria-label={`Quitar uno de ${product.name}`} className={step}>
          <Minus aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        </button>
        <span className="text-[13px] font-bold tabular-nums" aria-label={`${quantity} en el carrito`}>
          {quantity}
        </span>
        <button type="button" onClick={() => change(quantity + 1)} disabled={quantity >= max} aria-label={`Agregar otro de ${product.name}`} className={step}>
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        </button>
      </div>
      {status}
    </>
  );
}
