"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { itemCount } from "@/lib/cart";
import { useCart } from "@/lib/use-cart";

/** Ícono de carrito con el contador de productos. Antes de hidratar siempre vale cero, así no hay desajuste con el servidor. */
export function CartLink({ className = "" }: { className?: string }) {
  const count = itemCount(useCart());
  return (
    <Link href="/carrito" aria-label={count > 0 ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito"} className={`relative flex size-11 items-center justify-center rounded-full text-tinta transition-colors duration-500 ease-fluido hover:bg-selva/5 focus-visible:outline-2 focus-visible:outline-hoja ${className}`}>
      <ShoppingCart aria-hidden="true" className="size-5" />
      {count > 0 ? (
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-hoja px-1 text-[11px] font-bold leading-5 text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
