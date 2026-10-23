"use client";

import { Alert, Button, buttonStyles, ButtonIsland, Card, EmptyState } from "@rapitrip/ui";
import { Minus, Plus, Store, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { acceptPrices, emptyCart, removeLine, removeStore, setQuantity, setStoreName, storeGroups, toQuoteItems, type StoreGroup } from "@/lib/cart";
import { setCart, updateCart } from "@/lib/cart-store";
import type { Quote } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { changedPrices, hasBlocking, isBlocking, problemMessage, resolveProblems } from "@/lib/quote-problems";
import { useCart } from "@/lib/use-cart";
import type { QuoteResult } from "./actions";

/** Cada tienda del carrito es una entrega aparte: se cotiza, se revisa y se paga por separado. */
export function CartView({ quoteAction }: { quoteAction: (input: unknown) => Promise<QuoteResult> }) {
  const cart = useCart();
  const groups = useMemo(() => storeGroups(cart), [cart]);
  const [hydrated, setHydrated] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const key = useMemo(() => JSON.stringify(groups.map((group) => [group.storeId, toQuoteItems(group)])), [groups]);

  // El carrito vive en el navegador: hasta hidratar no se sabe si está vacío.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || groups.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const results = await Promise.all(groups.map(async (group) => ({ group, result: await quoteAction({ storeId: group.storeId, items: toQuoteItems(group) }) })));
      if (cancelled) return;
      setLoading(false);
      const nextQuotes: Record<string, Quote> = {};
      const nextErrors: Record<string, string> = {};
      for (const { group, result } of results) {
        if (!result.ok) {
          nextErrors[group.storeId] = result.error;
          continue;
        }
        nextQuotes[group.storeId] = result.quote;
        // La primera vez que se ve un precio se recuerda, sin avisar de nada.
        const unseen = Object.fromEntries(result.quote.lines.filter((q) => group.lines.find((l) => l.variantId === q.variant_id)?.seenPrice === null).map((q) => [q.variant_id, q.unit_price]));
        if (Object.keys(unseen).length > 0) updateCart((c) => acceptPrices(c, unseen));
        const name = result.quote.store?.name;
        if (name && group.storeName !== name) updateCart((c) => setStoreName(c, group.storeId, name));
      }
      setQuotes(nextQuotes);
      setErrors(nextErrors);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // La clave resume el contenido del carrito; `groups` completo reiniciaría la espera sin necesidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, quoteAction]);

  if (!hydrated) return <p className="py-10 text-center text-sm text-tinta-suave" aria-live="polite">Cargando tu carrito…</p>;

  if (groups.length === 0) {
    return (
      <EmptyState title="Tu carrito está vacío">
        Explora las tiendas y agrega lo que necesites.
        <span className="mt-4 block">
          <Link href="/tiendas" className={buttonStyles({ variant: "primary", className: "pr-5" })}>
            Ver tiendas
            <ButtonIsland />
          </Link>
        </span>
      </EmptyState>
    );
  }

  const storeName = (group: StoreGroup) => quotes[group.storeId]?.store?.name ?? group.storeName ?? "Tienda";
  const ready = (group: StoreGroup) => !loading && !!quotes[group.storeId] && !hasBlocking(quotes[group.storeId] ?? null);
  const knownTotal = groups.every((group) => quotes[group.storeId]);
  const allReady = groups.every(ready);
  const subtotal = groups.reduce((sum, group) => sum + (quotes[group.storeId]?.subtotal ?? 0), 0);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        {groups.length > 1 ? (
          <Alert tone="info">
            Tienes productos de {groups.length} tiendas. Cada tienda es una entrega aparte, con su propio envío.
          </Alert>
        ) : null}
        {groups.map((group) => (
          <StoreSection key={group.storeId} group={group} name={storeName(group)} quote={quotes[group.storeId] ?? null} error={errors[group.storeId] ?? null} loading={loading} />
        ))}
        <button type="button" onClick={() => setCart(emptyCart)} className="self-start text-[13px] font-bold text-tinta-suave underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-hoja">
          Vaciar carrito
        </button>
      </div>

      <Card outerClassName="lg:sticky lg:top-28" className="flex flex-col gap-3 p-5">
        <h2 className="text-base font-bold text-tinta">Resumen</h2>
        <dl className="flex flex-col gap-1.5 text-[14px]">
          {groups.map((group) => (
            <div key={group.storeId} className="flex justify-between gap-3">
              <dt className="min-w-0 truncate text-tinta-suave">{storeName(group)}</dt>
              <dd className="font-bold">{quotes[group.storeId] ? formatMoney(quotes[group.storeId]!.subtotal) : "—"}</dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Envío</dt>
            <dd className="text-[13px] font-bold text-tinta-suave">{groups.length > 1 ? "Uno por tienda, según tu ubicación" : "Según tu ubicación"}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-borde pt-2 text-[16px]">
            <dt className="font-extrabold">Subtotal</dt>
            <dd className="font-extrabold text-hoja">{knownTotal ? formatMoney(subtotal) : "—"}</dd>
          </div>
        </dl>
        {allReady ? (
          <Link href="/checkout" className={buttonStyles({ variant: "primary", className: "w-full pr-5" })}>
            Continuar con la compra
            <ButtonIsland />
          </Link>
        ) : (
          <Button variant="primary" disabled className="w-full">
            {loading || !knownTotal ? "Actualizando precios…" : "Resuelve los avisos para continuar"}
          </Button>
        )}
        {groups.length > 1 ? <p className="text-xs text-tinta-suave">Pagas todo en una sola compra: se crea un pedido por cada entrega.</p> : null}
        <p className="text-xs text-tinta-suave">Para pagar te pedimos ingresar o crear tu cuenta. Tu carrito se conserva.</p>
      </Card>
    </div>
  );
}

function StoreSection({ group, name, quote, error, loading }: { group: StoreGroup; name: string; quote: Quote | null; error: string | null; loading: boolean }) {
  const problems = quote?.problems ?? [];
  const priceChanges = problems.filter((p) => p.code === "precio_cambiado");
  const fixable = problems.some((p) => p.code === "sin_stock" || p.code === "producto_no_disponible" || p.code === "cantidad_invalida");

  return (
    <section aria-label={`Productos de ${name}`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-extrabold text-tinta">
          <Store aria-hidden="true" className="size-4 shrink-0 text-hoja" />
          <span className="truncate">{name}</span>
          {quote ? <span className="text-[13px] font-bold text-tinta-suave">· {formatMoney(quote.subtotal)}</span> : null}
        </h2>
        <button type="button" onClick={() => updateCart((c) => removeStore(c, group.storeId))} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-rojo hover:bg-rosa focus-visible:outline-2 focus-visible:outline-rojo">
          <Trash2 aria-hidden="true" className="size-4" />
          Quitar tienda
        </button>
      </div>
      {problems.length > 0 ? (
        <Alert tone={problems.some(isBlocking) ? "warning" : "info"}>
          <p className="font-bold">Revisa esta tienda</p>
          <ul className="mt-1 list-disc pl-4">
            {problems.map((problem, index) => (
              <li key={`${problem.code}-${problem.variant_id ?? index}`}>{problemMessage(problem, quote)}</li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {priceChanges.length > 0 ? (
              <Button variant="secondary" onClick={() => updateCart((c) => acceptPrices(c, changedPrices(problems)))}>
                Aceptar los nuevos precios
              </Button>
            ) : null}
            {fixable ? (
              <Button variant="secondary" onClick={() => updateCart((c) => resolveProblems(c, problems))}>
                Ajustar mi carrito
              </Button>
            ) : null}
          </div>
        </Alert>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <ul className="flex flex-col gap-3">
        {group.lines.map((line) => {
          const q = quote?.lines.find((l) => l.variant_id === line.variantId);
          const max = q?.max_per_order == null ? 99 : Math.min(99, q.max_per_order);
          return (
            <li key={line.variantId} className="flex gap-4 rounded-concha bg-papel p-3 shadow-suave ring-1 ring-selva/[0.07]">
              <ProductImage path={q?.cover_path} alt={q?.product_name ?? "Producto"} className="size-20 shrink-0 rounded-2xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {q ? (
                      <Link href={`/productos/${q.product_id}`} className="block truncate text-[15px] font-bold text-tinta hover:underline">
                        {q.product_name}
                      </Link>
                    ) : (
                      <p className="text-[15px] font-bold text-tinta">{quote || error ? "Producto no disponible" : loading ? "Cargando…" : ""}</p>
                    )}
                    {q ? <p className="text-xs text-tinta-suave">{q.variant_name} · {formatMoney(q.unit_price)} c/u</p> : null}
                  </div>
                  <p className="text-[15px] font-extrabold text-hoja">{q ? formatMoney(q.line_total) : ""}</p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <div role="group" aria-label={`Cantidad de ${q?.product_name ?? "producto"}`} className="flex items-center rounded-full border border-borde-campo bg-white">
                    <button type="button" aria-label="Menos" onClick={() => updateCart((c) => setQuantity(c, line.variantId, line.quantity - 1, max))} className="flex size-11 items-center justify-center rounded-full hover:bg-menta/70 focus-visible:outline-2 focus-visible:outline-hoja">
                      <Minus aria-hidden="true" className="size-4" />
                    </button>
                    <span aria-live="polite" className="min-w-8 text-center text-sm font-bold">
                      {line.quantity}
                    </span>
                    <button type="button" aria-label="Más" disabled={line.quantity >= max} onClick={() => updateCart((c) => setQuantity(c, line.variantId, line.quantity + 1, max))} className="flex size-11 items-center justify-center rounded-full hover:bg-menta/70 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-hoja">
                      <Plus aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  <button type="button" onClick={() => updateCart((c) => removeLine(c, line.variantId))} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-rojo hover:bg-rosa focus-visible:outline-2 focus-visible:outline-rojo">
                    <Trash2 aria-hidden="true" className="size-4" />
                    Quitar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
