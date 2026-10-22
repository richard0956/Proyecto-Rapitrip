"use client";

import { Button, Dialog } from "@rapitrip/ui";
import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { addToCart } from "@/lib/cart";
import { updateCart } from "@/lib/cart-store";
import type { CatalogProduct } from "@/lib/catalog";
import { useCart } from "@/lib/use-cart";

/**
 * Botón redondo de la tarjeta: agrega 1 unidad de la presentación más barata disponible. Solo se usa cuando el producto tiene
 * una única presentación; con varias, la tarjeta lleva a la ficha para elegir. El carrito es de una sola tienda: si ya hay
 * otra, se pregunta antes de vaciarlo.
 */
export function QuickAdd({ product }: { product: CatalogProduct }) {
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);

  function add(replaceOtherStore = false) {
    let status = "";
    updateCart((current) => {
      const result = addToCart(
        current,
        { storeId: product.store_id, storeName: product.store_name, variantId: product.quick_variant_id, quantity: 1, seenPrice: product.min_price, maxPerOrder: product.quick_max },
        { replaceOtherStore },
      );
      status = result.status;
      return result.cart;
    });
    if (status === "store_conflict") return setConflict(true);
    setConflict(false);
    if (status === "full") setMessage("Tu carrito ya tiene el máximo de productos distintos.");
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
        onClick={() => add()}
        aria-label={`Agregar ${product.name} al carrito`}
        className={`relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-pulsa transition-[background-color,transform] duration-500 ease-fluido hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja ${added ? "bg-exito" : "bg-hoja hover:bg-selva"}`}
      >
        {added ? <Check aria-hidden="true" className="size-5" /> : <ShoppingCart aria-hidden="true" className="size-5" />}
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
      <Dialog open={conflict} onClose={() => setConflict(false)} title="Tu carrito es de otra tienda">
        <p className="text-sm text-tinta-suave">
          Cada pedido es de una sola tienda. Tu carrito tiene productos de {cart.storeName ?? "otra tienda"}. ¿Quieres vaciarlo y empezar uno nuevo con productos de {product.store_name}?
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => add(true)}>
            Vaciar y agregar
          </Button>
          <Button variant="secondary" onClick={() => setConflict(false)}>
            Mantener mi carrito
          </Button>
        </div>
      </Dialog>
    </>
  );
}
