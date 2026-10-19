import type { Metadata } from "next";
import { CartView } from "./cart-view";
import { quoteCartAction } from "./actions";

export const metadata: Metadata = { title: "Mi carrito", robots: { index: false } };

export default function CarritoPage() {
  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta">Mi carrito</h1>
      <p className="mb-6 mt-1 text-[14px] text-tinta-suave">Revisa tus productos. Los precios y el stock se confirman al momento de pagar.</p>
      <CartView quoteAction={quoteCartAction} />
    </main>
  );
}
