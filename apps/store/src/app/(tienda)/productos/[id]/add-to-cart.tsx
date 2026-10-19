"use client";

import { Alert, Button, Dialog } from "@rapitrip/ui";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { addToCart } from "@/lib/cart";
import { updateCart } from "@/lib/cart-store";
import type { ProductVariant } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { useCart } from "@/lib/use-cart";

type Props = { storeId: string; storeName: string; storeOpen: boolean; variants: ProductVariant[] };

/** Variante, cantidad y «Agregar al carrito». El carrito es de una sola tienda: si ya hay otra, el cliente decide si lo vacía. */
export function AddToCart({ storeId, storeName, storeOpen, variants }: Props) {
  const firstAvailable = variants.find((v) => v.available) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [conflict, setConflict] = useState(false);
  const cart = useCart();
  const groupId = useId();

  const variant = useMemo(() => variants.find((v) => v.id === variantId), [variants, variantId]);
  const limit = variant?.max_per_order == null ? 99 : Math.min(99, variant.max_per_order);
  const canBuy = storeOpen && !!variant?.available;

  function add(replaceOtherStore = false) {
    if (!variant) return;
    let status: string = "";
    updateCart((current) => {
      const result = addToCart(
        current,
        { storeId, storeName, variantId: variant.id, quantity, seenPrice: variant.price, maxPerOrder: variant.max_per_order },
        { replaceOtherStore },
      );
      status = result.status;
      return result.cart;
    });
    if (status === "store_conflict") return setConflict(true);
    setConflict(false);
    if (status === "capped") setNotice({ tone: "warning", text: `Solo puedes pedir hasta ${limit} de este producto. Ajustamos la cantidad.` });
    else if (status === "full") setNotice({ tone: "warning", text: "Tu carrito ya tiene el máximo de productos distintos (30)." });
    else if (status === "invalid") setNotice({ tone: "warning", text: "No se pudo agregar este producto." });
    else setNotice({ tone: "info", text: "Agregado al carrito." });
  }

  if (variants.length === 0) return <Alert tone="warning">Este producto no tiene presentaciones disponibles.</Alert>;

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 1 ? (
        <fieldset>
          <legend className="text-xs font-bold text-tinta-suave">Presentación</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((v) => {
              const selected = v.id === variantId;
              return (
                <label
                  key={v.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hoja ${selected ? "border-hoja bg-hoja text-white" : "border-borde-campo bg-papel text-tinta hover:bg-menta/70"} ${v.available ? "" : "opacity-60"}`}
                >
                  <input type="radio" name={`variante-${groupId}`} value={v.id} checked={selected} onChange={() => { setVariantId(v.id); setQuantity(1); setNotice(null); }} className="sr-only" />
                  {v.name} · {formatMoney(v.price)}
                  {v.available ? "" : " · Agotado"}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <p className="text-[26px] font-extrabold tracking-tight text-hoja" aria-live="polite">
        {variant ? formatMoney(variant.price) : "—"}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Cantidad" className="flex items-center rounded-full border border-borde-campo bg-white">
          <button type="button" aria-label="Menos" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex size-11 items-center justify-center rounded-full hover:bg-menta/70 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-hoja">
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <span aria-live="polite" className="min-w-8 text-center text-sm font-bold">
            {quantity}
          </span>
          <button type="button" aria-label="Más" disabled={quantity >= limit} onClick={() => setQuantity((q) => Math.min(limit, q + 1))} className="flex size-11 items-center justify-center rounded-full hover:bg-menta/70 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-hoja">
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        <Button variant="primary" disabled={!canBuy} onClick={() => add()} className="min-h-11">
          <ShoppingCart aria-hidden="true" className="size-4" />
          Agregar al carrito
        </Button>
      </div>

      {!storeOpen ? <Alert tone="warning">La tienda está cerrada: no puedes hacer pedidos por ahora.</Alert> : null}
      {storeOpen && variant && !variant.available ? <Alert tone="warning">Esta presentación está agotada.</Alert> : null}
      {variant?.max_per_order != null && variant.available && variant.max_per_order <= 5 ? <p className="text-xs font-bold text-durazno-texto">Quedan pocas unidades.</p> : null}
      {notice ? (
        <Alert tone={notice.tone}>
          {notice.text}{" "}
          {notice.tone === "info" ? (
            <Link href="/carrito" className="font-bold underline">
              Ver carrito ({cart.lines.length})
            </Link>
          ) : null}
        </Alert>
      ) : null}

      <Dialog open={conflict} onClose={() => setConflict(false)} title="Tu carrito es de otra tienda">
        <p className="text-sm text-tinta-suave">
          Cada pedido es de una sola tienda. Tu carrito tiene productos de {cart.storeName ?? "otra tienda"}. ¿Quieres vaciarlo y empezar uno nuevo con productos de {storeName}?
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
    </div>
  );
}
