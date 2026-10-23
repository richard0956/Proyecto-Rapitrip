"use client";

import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { addToCart } from "@/lib/cart";
import { updateCart } from "@/lib/cart-store";
import type { CatalogProduct } from "@/lib/catalog";
import { MAX_STORES } from "@/lib/cart";

/**
 * Botón redondo de la tarjeta: agrega 1 unidad de la presentación más barata disponible. Solo se usa cuando el producto tiene
 * una única presentación; con varias, la tarjeta lleva a la ficha para elegir. El carrito admite varias tiendas (hasta
 * MAX_STORES); la compra se divide después en un pedido por tienda.
 */
export function QuickAdd({ product }: { product: CatalogProduct }) {
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState("");

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
    else {
      setMessage(`${product.name} agregado al carrito.`);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={add}
        aria-label={`Agregar ${product.name} al carrito`}
        className={`relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-pulsa transition-[background-color,transform] duration-500 ease-fluido hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja ${added ? "bg-exito" : "bg-hoja hover:bg-selva"}`}
      >
        {added ? <Check aria-hidden="true" className="size-5" /> : <ShoppingCart aria-hidden="true" className="size-5" />}
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}
