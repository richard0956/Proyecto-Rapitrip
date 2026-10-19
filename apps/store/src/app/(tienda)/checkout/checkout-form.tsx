"use client";

import { Alert, Button, buttonStyles, Card, EmptyState, Field, TextareaField } from "@rapitrip/ui";
import { Banknote, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { acceptPrices, emptyCart, toOrderItems, toQuoteItems } from "@/lib/cart";
import { setCart, updateCart } from "@/lib/cart-store";
import type { Quote } from "@/lib/catalog";
import { saveDraft, takeDraft } from "@/lib/draft";
import { formatMoney } from "@/lib/money";
import { changedPrices, hasBlocking, isBlocking, problemMessage, resolveProblems } from "@/lib/quote-problems";
import { useCart } from "@/lib/use-cart";
import type { QuoteResult } from "../carrito/actions";
import type { PlaceOrderResult } from "./actions";

export type CheckoutAddress = { id: string; label: string; address: string; phone: string | null; is_default: boolean };
type Method = "efectivo" | "tarjeta";
type Values = { addressId: string; address: string; saveAs: string; saveNew: boolean; phone: string; notes: string; method: Method };

const DRAFT_KEY = "rapitrip:checkout";
const NEW = "nueva";

type Props = {
  addresses: CheckoutAddress[];
  profilePhone: string;
  quoteAction: (input: unknown) => Promise<QuoteResult>;
  placeOrder: (input: unknown) => Promise<PlaceOrderResult>;
};

export function CheckoutForm({ addresses, profilePhone, quoteAction, placeOrder }: Props) {
  const router = useRouter();
  const cart = useCart();
  const initialAddress = addresses.find((a) => a.is_default) ?? addresses[0];
  const [values, setValues] = useState<Values>({
    addressId: initialAddress?.id ?? NEW,
    address: "",
    saveAs: "Casa",
    saveNew: false,
    phone: initialAddress?.phone || profilePhone,
    notes: "",
    method: "efectivo",
  });
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submitting = useRef(false);
  const attempt = useRef<{ key: string; ref: string } | null>(null);
  const key = useMemo(() => JSON.stringify(toQuoteItems(cart)) + cart.storeId, [cart]);

  useEffect(() => {
    const draft = takeDraft<Values>(DRAFT_KEY);
    if (draft) {
      // Recuperar lo escrito antes de que venciera la sesión solo es posible tras hidratar (sessionStorage).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(draft);
      setRestored(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !cart.storeId || cart.lines.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await quoteAction({ storeId: cart.storeId, items: toQuoteItems(cart) });
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setQuote(result.quote);
        setError(null);
      } else setError(result.error);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // La clave resume el contenido del carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, quoteAction]);

  if (!hydrated) return <p className="py-10 text-center text-sm text-tinta-suave" aria-live="polite">Preparando tu pedido…</p>;

  if (cart.lines.length === 0) {
    return (
      <EmptyState title="Tu carrito está vacío">
        Agrega productos antes de pagar.
        <span className="mt-4 block">
          <Link href="/tiendas" className={buttonStyles({ variant: "primary" })}>
            Ver tiendas
          </Link>
        </span>
      </EmptyState>
    );
  }

  const problems = quote?.problems ?? [];
  const priceChanges = problems.filter((p) => p.code === "precio_cambiado");
  const blocked = !quote || loading || hasBlocking(quote) || priceChanges.length > 0;
  const chosen = addresses.find((a) => a.id === values.addressId);
  const addressText = (values.addressId === NEW ? values.address : (chosen?.address ?? "")).trim();
  const set = <K extends keyof Values>(name: K, value: Values[K]) => setValues((v) => ({ ...v, [name]: value }));

  function pickAddress(id: string) {
    const saved = addresses.find((a) => a.id === id);
    setValues((v) => ({ ...v, addressId: id, phone: saved?.phone || v.phone || profilePhone }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || blocked || !cart.storeId) return;
    setFieldError(null);
    setError(null);
    if (addressText.length < 5) return setFieldError("Escribe la dirección de entrega (al menos 5 caracteres).");
    if (!/^[0-9+() -]{8,20}$/.test(values.phone.trim())) return setFieldError("Escribe un teléfono válido para coordinar la entrega.");

    // Una referencia por intento: si nada cambió, un reintento devuelve el mismo pedido en vez de crear otro.
    const payload = JSON.stringify([cart.storeId, toOrderItems(cart), values.method, addressText, values.phone.trim(), values.notes.trim()]);
    if (attempt.current?.key !== payload) attempt.current = { key: payload, ref: crypto.randomUUID() };
    const clientRef = attempt.current.ref;

    submitting.current = true;
    start(async () => {
      try {
        const result = await placeOrder({
          store_id: cart.storeId,
          items: toOrderItems(cart),
          payment_method: values.method,
          address: addressText,
          phone: values.phone.trim(),
          notes: values.notes.trim(),
          client_ref: clientRef,
          save_address_as: values.addressId === NEW && values.saveNew ? values.saveAs.trim() || "Casa" : null,
        });
        if (!result.ok) {
          if (result.expired) {
            saveDraft(DRAFT_KEY, values);
            router.replace(`/ingresar?next=${encodeURIComponent("/checkout")}&expirada=1`);
            return;
          }
          setError(result.error);
          return;
        }
        setCart(emptyCart);
        // Con tarjeta se sale hacia Stripe navegando (la CSP no permite enviar formularios fuera del sitio).
        if (result.payUrl) window.location.assign(result.payUrl);
        else router.replace(`/pedidos/${result.orderId}${result.payError ? "?pago=error" : ""}`);
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-5">
        {restored ? <Alert>Recuperamos lo que escribiste. Revisa y confirma tu pedido.</Alert> : null}

        <Card className="p-6">
          <h2 className="text-base font-bold text-tinta">Dirección de entrega</h2>
          <fieldset className="mt-3 flex flex-col gap-2">
            <legend className="sr-only">Elige dónde recibir tu pedido</legend>
            {addresses.map((a) => (
              <label key={a.id} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-[13.5px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hoja ${values.addressId === a.id ? "border-hoja bg-menta/60" : "border-borde-campo bg-white"}`}>
                <input type="radio" name="direccion" checked={values.addressId === a.id} onChange={() => pickAddress(a.id)} className="mt-1 size-4 accent-[var(--hoja)]" />
                <span>
                  <span className="block font-bold text-tinta">{a.label}{a.is_default ? " · Predeterminada" : ""}</span>
                  <span className="text-tinta-suave">{a.address}</span>
                </span>
              </label>
            ))}
            <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-[13.5px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hoja ${values.addressId === NEW ? "border-hoja bg-menta/60" : "border-borde-campo bg-white"}`}>
              <input type="radio" name="direccion" checked={values.addressId === NEW} onChange={() => pickAddress(NEW)} className="size-4 accent-[var(--hoja)]" />
              <span className="font-bold text-tinta">{addresses.length ? "Usar otra dirección" : "Escribir mi dirección"}</span>
            </label>
          </fieldset>
          {values.addressId === NEW ? (
            <div className="mt-3 flex flex-col gap-3">
              <TextareaField label="Dirección de entrega" maxLength={240} value={values.address} onChange={(e) => set("address", e.target.value)} placeholder="Barrio, calle, número de casa y una referencia" />
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13.5px] font-bold text-tinta">
                <input type="checkbox" checked={values.saveNew} onChange={(e) => set("saveNew", e.target.checked)} className="size-5 accent-[var(--hoja)]" />
                Guardar en mis direcciones
              </label>
              {values.saveNew ? <Field label="Nombre de la dirección" maxLength={40} value={values.saveAs} onChange={(e) => set("saveAs", e.target.value)} /> : null}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-tinta-suave">
            <Link href="/perfil/direcciones" className="font-bold text-hoja hover:underline">
              Administrar mis direcciones
            </Link>
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Field label="Teléfono de contacto" type="tel" autoComplete="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} required />
            <TextareaField label="Nota para el comercio o el repartidor (opcional)" rows={2} maxLength={240} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-bold text-tinta">Forma de pago</h2>
          <fieldset className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="sr-only">Elige cómo pagar</legend>
            {([
              { value: "efectivo", title: "Efectivo contra entrega", text: "Pagas al recibir tu pedido.", Icon: Banknote },
              { value: "tarjeta", title: "Tarjeta", text: "Pagas ahora en una página segura de Stripe.", Icon: CreditCard },
            ] as const).map(({ value, title, text, Icon }) => (
              <label key={value} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-[13.5px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hoja ${values.method === value ? "border-hoja bg-menta/60" : "border-borde-campo bg-white"}`}>
                <input type="radio" name="pago" checked={values.method === value} onChange={() => set("method", value)} className="mt-1 size-4 accent-[var(--hoja)]" />
                <span>
                  <span className="flex items-center gap-2 font-bold text-tinta">
                    <Icon aria-hidden="true" className="size-4" />
                    {title}
                  </span>
                  <span className="text-tinta-suave">{text}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Card>
      </div>

      <Card outerClassName="lg:sticky lg:top-28" className="flex flex-col gap-3 p-5">
        <h2 className="text-base font-bold text-tinta">Resumen{quote?.store ? ` · ${quote.store.name}` : ""}</h2>
        {problems.length > 0 ? (
          <Alert tone="warning">
            <ul className="list-disc pl-4">
              {problems.map((p, index) => (
                <li key={`${p.code}-${p.variant_id ?? index}`}>{problemMessage(p, quote)}</li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {priceChanges.length > 0 ? (
                <Button variant="secondary" onClick={() => updateCart((c) => acceptPrices(c, changedPrices(problems)))}>
                  Aceptar los nuevos precios
                </Button>
              ) : null}
              {problems.some((p) => isBlocking(p) && p.variant_id) ? (
                <Button variant="secondary" onClick={() => updateCart((c) => resolveProblems(c, problems))}>
                  Ajustar mi carrito
                </Button>
              ) : null}
              <Link href="/carrito" className={buttonStyles({ variant: "ghost" })}>
                Ver carrito
              </Link>
            </div>
          </Alert>
        ) : null}
        <ul className="flex flex-col gap-1.5 text-[13.5px]">
          {quote?.lines.map((line) => (
            <li key={line.variant_id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{line.quantity} × {line.product_name} <span className="text-tinta-suave">({line.variant_name})</span></span>
              <span className="font-bold">{formatMoney(line.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1.5 border-t border-borde pt-3 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Subtotal</dt>
            <dd className="font-bold">{quote ? formatMoney(quote.subtotal) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Envío</dt>
            <dd className="font-bold">{quote ? (quote.delivery_fee > 0 ? formatMoney(quote.delivery_fee) : "Gratis") : "—"}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-borde pt-2 text-[16px]">
            <dt className="font-extrabold">Total</dt>
            <dd className="font-extrabold text-hoja">{quote ? formatMoney(quote.total) : "—"}</dd>
          </div>
        </dl>
        {fieldError ? <Alert tone="error">{fieldError}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button variant="primary" type="submit" disabled={blocked || pending} className="w-full">
          {pending ? "Enviando tu pedido…" : loading || !quote ? "Actualizando precios…" : values.method === "tarjeta" ? "Confirmar y pagar" : "Confirmar pedido"}
        </Button>
        <p className="text-xs text-tinta-suave">
          {values.method === "tarjeta" ? "Te llevamos a la página segura de Stripe. Los datos de tu tarjeta nunca pasan por Rapitrip." : "El comercio tiene 45 minutos para confirmar tu pedido."}
        </p>
      </Card>
    </form>
  );
}
