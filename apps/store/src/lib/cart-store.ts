import { type Cart, emptyCart, parseCart } from "./cart";

/**
 * Almacén externo del carrito (localStorage), un solo origen de verdad para el contador de la navegación y las páginas.
 * Se sincroniza entre pestañas con el evento `storage`. Si el almacenamiento no está disponible (modo privado, bloqueado),
 * el carrito sigue funcionando en memoria durante la visita.
 */
export const CART_KEY = "rapitrip-cart-v1";

let current: Cart = emptyCart;
let loaded = false;
const listeners = new Set<() => void>();

function read(): Cart {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? parseCart(JSON.parse(raw)) : emptyCart;
  } catch {
    return emptyCart;
  }
}

function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    current = read();
    loaded = true;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function getCartSnapshot(): Cart {
  ensureLoaded();
  return current;
}

export function getServerCartSnapshot(): Cart {
  return emptyCart;
}

export function setCart(next: Cart): void {
  ensureLoaded();
  current = next;
  try {
    if (next.lines.length === 0) localStorage.removeItem(CART_KEY);
    else localStorage.setItem(CART_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento: queda solo en memoria.
  }
  emit();
}

export function updateCart(fn: (cart: Cart) => Cart): void {
  setCart(fn(getCartSnapshot()));
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_KEY || event.key === null) {
      current = read();
      loaded = true;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Solo para pruebas. */
export function resetCartStoreForTests() {
  current = emptyCart;
  loaded = false;
  listeners.clear();
}
