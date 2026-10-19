"use client";

import { useSyncExternalStore } from "react";
import type { Cart } from "./cart";
import { getCartSnapshot, getServerCartSnapshot, subscribeCart } from "./cart-store";

/** El carrito del navegador. En el servidor (y en la hidratación) siempre es vacío, así no hay desajustes. */
export function useCart(): Cart {
  return useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);
}
