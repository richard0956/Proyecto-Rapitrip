"use client";

import { ShoppingBasket, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { itemCount } from "@/lib/cart";
import { useCart } from "@/lib/use-cart";

/**
 * Botón redondo del carrito. Vacío es solo el ícono del carrito sobre blanco; con productos se vuelve verde, cambia a la canasta
 * llena y muestra la cantidad en un círculo. Antes de hidratar siempre vale cero, así no hay desajuste con el servidor.
 */
export function CartLink({ className = "" }: { className?: string }) {
  const count = itemCount(useCart());
  const filled = count > 0;
  return (
    <Link
      href="/carrito"
      aria-label={filled ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito vacío"}
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ease-fluido focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja ${
        filled ? "bg-selva text-white shadow-pulsa hover:bg-tinta" : "bg-white text-tinta ring-1 ring-selva/[0.08] hover:bg-crema"
      } ${className}`}
    >
      {filled ? <ShoppingBasket aria-hidden="true" className="size-5" /> : <ShoppingCart aria-hidden="true" className="size-5" />}
      {filled ? (
        <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-esmeralda px-1 text-[11px] font-extrabold leading-none text-selva ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
