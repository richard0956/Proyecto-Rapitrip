"use client";

import { PinPicker, type LatLng } from "@rapitrip/maps";
import { Alert, Badge, Button, buttonStyles, Card, EmptyState, Field, TextareaField } from "@rapitrip/ui";
import { Banknote, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { acceptPrices, emptyCart, removeStore, storeGroups, toOrderItems, toQuoteItems, type StoreGroup } from "@/lib/cart";
import { setCart, updateCart } from "@/lib/cart-store";
import type { Quote } from "@/lib/catalog";
import { classLabel, deliveryTotal, etaText, reasonText, shipmentCount, shipmentSubtotal, type GroupQuote } from "@/lib/delivery-class";
import { saveDraft, takeDraft } from "@/lib/draft";
import { formatMoney } from "@/lib/money";
import { changedPrices, hasBlocking, isBlocking, problemMessage, resolveProblems } from "@/lib/quote-problems";
import { useCart } from "@/lib/use-cart";
import type { QuoteResult } from "../carrito/actions";
import type { GroupQuoteResult, PlaceCheckoutResult } from "./actions";

export type CheckoutAddress = { id: string; label: string; address: string; phone: string | null; is_default: boolean; latitude?: number | null; longitude?: number | null; department?: string | null };
type Method = "efectivo" | "tarjeta";
type Values = { addressId: string; address: string; saveAs: string; saveNew: boolean; phone: string; notes: string; method: Method; point: LatLng | null };

/** El pin guardado con una dirección de la libreta, si lo tiene. */
const pointOf = (address?: CheckoutAddress): LatLng | null => (address && address.latitude != null && address.longitude != null ? { lat: address.latitude, lng: address.longitude } : null);

const DRAFT_KEY = "rapitrip:checkout";
const NEW = "nueva";

type Props = {
  addresses: CheckoutAddress[];
  profilePhone: string;
  /** Precios, stock y avisos de cada tienda del carrito. */
  quoteAction: (input: unknown) => Promise<QuoteResult>;
  /** Clase, costo y plazo de los envíos de cada tienda hacia el punto elegido. */
  quoteGroup: (input: unknown) => Promise<GroupQuoteResult>;
  placeCheckout: (input: unknown) => Promise<PlaceCheckoutResult>;
};

type DeliveryEntry = GroupQuote & { quoteId: string | null };

/**
 * Checkout único: una dirección y un punto del mapa para toda la compra. Cada tienda del carrito sale en uno o dos
 * envíos (express en moto, programado con vehículo), cada uno con su costo y su plazo. Se crean todos los pedidos o ninguno.
 */
export function CheckoutForm({ addresses, profilePhone, quoteAction, quoteGroup, placeCheckout }: Props) {
  const router = useRouter();
  const cart = useCart();
  const groups = useMemo(() => storeGroups(cart), [cart]);
  const initialAddress = addresses.find((a) => a.is_default) ?? addresses[0];
  const [values, setValues] = useState<Values>({
    addressId: initialAddress?.id ?? NEW,
    address: "",
    saveAs: "Casa",
    saveNew: false,
    phone: initialAddress?.phone || profilePhone,
    notes: "",
    method: "efectivo",
    point: pointOf(initialAddress),
  });
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, DeliveryEntry>>({});
  const [deliveryErrors, setDeliveryErrors] = useState<Record<string, string>>({});
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  // Sube cuando hay que pedir otras cotizaciones (por ejemplo, si una venció antes de confirmar).
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [pending, start] = useTransition();
  const submitting = useRef(false);
  const attempt = useRef<{ key: string; ref: string } | null>(null);
  const key = useMemo(() => JSON.stringify(groups.map((group) => [group.storeId, toQuoteItems(group)])), [groups]);

  useEffect(() => {
    const draft = takeDraft<Values>(DRAFT_KEY);
    if (draft) {
      // Recuperar lo escrito antes de que venciera la sesión solo es posible tras hidratar (sessionStorage).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues({ ...draft, point: draft.point ?? null });
      setRestored(true);
    }
    setHydrated(true);
  }, []);

  // Precios, stock y avisos de cada tienda.
  useEffect(() => {
    if (!hydrated || groups.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const results = await Promise.all(groups.map(async (group) => ({ group, result: await quoteAction({ storeId: group.storeId, items: toQuoteItems(group) }) })));
      if (cancelled) return;
      setLoading(false);
      const next: Record<string, Quote> = {};
      let failed: string | null = null;
      for (const { group, result } of results) {
        if (result.ok) next[group.storeId] = result.quote;
        else failed = result.error;
      }
      setQuotes(next);
      setError(failed);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // La clave resume el contenido del carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, quoteAction]);

  // Envíos de cada tienda hacia el punto elegido (el departamento lo deduce la base de datos del punto).
  const pointLat = values.point?.lat;
  const pointLng = values.point?.lng;
  useEffect(() => {
    if (!hydrated || groups.length === 0) return;
    if (pointLat === undefined || pointLng === undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeliveries({});
      setDeliveryErrors({});
      return;
    }
    let cancelled = false;
    setDeliveryLoading(true);
    const timer = setTimeout(async () => {
      const results = await Promise.all(
        groups.map(async (group) => ({ group, result: await quoteGroup({ store_id: group.storeId, items: toOrderItems(group), latitude: pointLat, longitude: pointLng }) })),
      );
      if (cancelled) return;
      setDeliveryLoading(false);
      const nextDeliveries: Record<string, DeliveryEntry> = {};
      const nextErrors: Record<string, string> = {};
      for (const { group, result } of results) {
        if (result.ok) nextDeliveries[group.storeId] = { origin_department: result.origin_department, destination_department: result.destination_department, shipments: result.shipments, quoteId: result.quoteId };
        else nextErrors[group.storeId] = result.error;
      }
      setDeliveries(nextDeliveries);
      setDeliveryErrors(nextErrors);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // La clave resume el contenido del carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointLat, pointLng, key, hydrated, quoteGroup, quoteNonce]);

  if (!hydrated) return <p className="py-10 text-center text-sm text-tinta-suave" aria-live="polite">Preparando tu compra…</p>;

  if (groups.length === 0) {
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

  const allQuoted = groups.every((group) => quotes[group.storeId]);
  const cartProblems = groups.flatMap((group) => quotes[group.storeId]?.problems ?? []);
  const priceChanges = cartProblems.filter((p) => p.code === "precio_cambiado");
  const cartBlocked = !allQuoted || loading || groups.some((group) => hasBlocking(quotes[group.storeId] ?? null)) || priceChanges.length > 0;
  const allDelivered = groups.every((group) => deliveries[group.storeId]);
  const deliveryBlocked = !values.point || !allDelivered || deliveryLoading || Object.keys(deliveryErrors).length > 0;
  // Solo cuentan las tiendas que siguen en el carrito: tras «Quitar tienda» el estado aún guarda la cotización de la quitada.
  const current = Object.fromEntries(groups.flatMap((group) => (deliveries[group.storeId] ? [[group.storeId, deliveries[group.storeId]] as const] : [])));
  const shipments = shipmentCount(current);
  const blocked = cartBlocked || deliveryBlocked;
  const chosen = addresses.find((a) => a.id === values.addressId);
  const addressText = (values.addressId === NEW ? values.address : (chosen?.address ?? "")).trim();
  const set = <K extends keyof Values>(name: K, value: Values[K]) => setValues((v) => ({ ...v, [name]: value }));
  const subtotal = groups.reduce((sum, group) => sum + (quotes[group.storeId]?.subtotal ?? 0), 0);
  const fees = deliveryTotal(current);

  function pickAddress(id: string) {
    const saved = addresses.find((a) => a.id === id);
    setValues((v) => ({ ...v, addressId: id, phone: saved?.phone || v.phone || profilePhone, point: pointOf(saved) }));
  }

  function goExpired() {
    saveDraft(DRAFT_KEY, values);
    router.replace(`/ingresar?next=${encodeURIComponent("/checkout")}&expirada=1`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    setFieldError(null);
    setError(null);
    if (!values.point) return setFieldError("Marca el punto exacto de entrega en el mapa.");
    if (addressText.length < 5) return setFieldError("Escribe la dirección de entrega (al menos 5 caracteres).");
    if (!/^[0-9+() -]{8,20}$/.test(values.phone.trim())) return setFieldError("Escribe un teléfono válido para coordinar la entrega.");

    const purchaseGroups = groups.map((group) => ({ store_id: group.storeId, items: toOrderItems(group), quote_id: deliveries[group.storeId]?.quoteId ?? null }));
    // Una referencia por intento: si nada cambió, un reintento devuelve la misma compra en vez de crear otra.
    const payload = JSON.stringify([purchaseGroups, values.method, addressText, values.phone.trim(), values.notes.trim(), values.point]);
    if (attempt.current?.key !== payload) attempt.current = { key: payload, ref: crypto.randomUUID() };
    const clientRef = attempt.current.ref;

    submitting.current = true;
    start(async () => {
      try {
        const result = await placeCheckout({
          groups: purchaseGroups,
          payment_method: values.method,
          address: addressText,
          phone: values.phone.trim(),
          notes: values.notes.trim(),
          latitude: values.point?.lat,
          longitude: values.point?.lng,
          client_ref: clientRef,
          save_address_as: values.addressId === NEW && values.saveNew ? values.saveAs.trim() || "Casa" : null,
        });
        if (!result.ok) {
          if (result.expired) return goExpired();
          setError(result.error);
          // Si una cotización del envío venció, se piden otras para que pueda confirmar de nuevo.
          if (/cotización del envío/i.test(result.error)) {
            setDeliveries({});
            setQuoteNonce((n) => n + 1);
          }
          return;
        }
        setCart(emptyCart);
        // Con tarjeta se sale hacia Stripe navegando (la CSP no permite enviar formularios fuera del sitio).
        if (result.payUrl) window.location.assign(result.payUrl);
        else if (result.orders.length === 1) router.replace(`/pedidos/${result.orders[0]!.order_id}${result.payError ? "?pago=error" : ""}`);
        else router.replace(`/compras/${result.checkoutId}${result.payError ? "?pago=error" : ""}`);
      } finally {
        submitting.current = false;
      }
    });
  }

  const confirmLabel = pending
    ? "Enviando tu compra…"
    : loading || !allQuoted
      ? "Actualizando precios…"
      : !values.point
        ? "Marca tu punto de entrega"
        : deliveryLoading
          ? "Calculando el envío…"
          : values.method === "tarjeta"
            ? "Confirmar y pagar"
            : shipments > 1
              ? "Confirmar compra"
              : "Confirmar pedido";

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-5">
        {restored ? <Alert>Recuperamos lo que escribiste. Revisa y confirma tu pedido.</Alert> : null}

        <Card className="p-6">
          <h2 className="text-base font-bold text-tinta">Dirección de entrega</h2>
          <fieldset className="mt-3 flex flex-col gap-2">
            <legend className="sr-only">Elige dónde recibir tu pedido</legend>
            {addresses.map((a) => (
              <label key={a.id} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-[13.5px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hoja ${values.addressId === a.id ? "border-hoja bg-menta/60" : "border-borde-campo bg-superficie"}`}>
                <input type="radio" name="direccion" checked={values.addressId === a.id} onChange={() => pickAddress(a.id)} className="mt-1 size-4 accent-[var(--hoja)]" />
                <span>
                  <span className="block font-bold text-tinta">{a.label}{a.is_default ? " · Predeterminada" : ""}</span>
                  <span className="text-tinta-suave">{a.address}</span>
                </span>
              </label>
            ))}
            <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-[13.5px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hoja ${values.addressId === NEW ? "border-hoja bg-menta/60" : "border-borde-campo bg-superficie"}`}>
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
            <Link href="/ajustes/direcciones" className="font-bold text-hoja hover:underline">
              Administrar mis direcciones
            </Link>
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <PinPicker
              label="Punto exacto de entrega"
              hint="Obligatorio: con tu punto sabemos si tu pedido llega en horas (express) o en días (programado), calculamos el envío según la distancia y el repartidor te encuentra. La dirección escrita sigue siendo necesaria."
              value={values.point}
              onChange={(point) => set("point", point)}
              onUseAddress={values.addressId === NEW ? (text) => set("address", text) : undefined}
              disabled={pending}
            />
          </div>
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
              { value: "efectivo", title: "Efectivo contra entrega", text: "Pagas al recibir cada entrega.", Icon: Banknote, enabled: true },
              { value: "tarjeta", title: "Tarjeta", text: shipments > 1 ? "Pagas ahora toda la compra, en un solo cobro, en una página segura de Stripe." : "Pagas ahora en una página segura de Stripe.", Icon: CreditCard, enabled: true },
            ] as const).map(({ value, title, text, Icon, enabled }) => (
              <label key={value} className={`flex min-h-11 items-start gap-3 rounded-2xl border px-4 py-3 text-[13.5px] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hoja ${enabled ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${values.method === value ? "border-hoja bg-menta/60" : "border-borde-campo bg-superficie"}`}>
                <input type="radio" name="pago" checked={values.method === value} disabled={!enabled && values.method !== value} onChange={() => set("method", value)} className="mt-1 size-4 accent-[var(--hoja)]" />
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

      <Card outerClassName="lg:sticky lg:top-28" className="flex flex-col gap-4 p-5">
        <h2 className="text-base font-bold text-tinta">Resumen de tu compra</h2>
        {groups.map((group) => (
          <StoreSummary
            key={group.storeId}
            group={group}
            quote={quotes[group.storeId] ?? null}
            delivery={deliveries[group.storeId] ?? null}
            deliveryError={deliveryErrors[group.storeId] ?? null}
            deliveryLoading={deliveryLoading}
            many={groups.length > 1}
          />
        ))}
        {cartProblems.length > 0 ? (
          <Alert tone="warning">
            <ul className="list-disc pl-4">
              {groups.flatMap((group) =>
                (quotes[group.storeId]?.problems ?? []).map((p, index) => <li key={`${group.storeId}-${p.code}-${p.variant_id ?? index}`}>{problemMessage(p, quotes[group.storeId] ?? null)}</li>),
              )}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {priceChanges.length > 0 ? (
                <Button variant="secondary" onClick={() => updateCart((c) => acceptPrices(c, changedPrices(cartProblems)))}>
                  Aceptar los nuevos precios
                </Button>
              ) : null}
              {cartProblems.some((p) => isBlocking(p) && p.variant_id) ? (
                <Button variant="secondary" onClick={() => updateCart((c) => resolveProblems(c, cartProblems))}>
                  Ajustar mi carrito
                </Button>
              ) : null}
              <Link href="/carrito" className={buttonStyles({ variant: "ghost" })}>
                Ver carrito
              </Link>
            </div>
          </Alert>
        ) : null}
        <dl className="flex flex-col gap-1.5 border-t border-borde pt-3 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Productos</dt>
            <dd className="font-bold">{allQuoted ? formatMoney(subtotal) : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-tinta-suave">{shipments > 1 ? `Envíos (${shipments})` : "Envío"}</dt>
            <dd className="font-bold">{allDelivered ? formatMoney(fees) : deliveryLoading ? "Calculando…" : "—"}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-borde pt-2 text-[16px]">
            <dt className="font-extrabold">{allDelivered ? "Total" : "Subtotal"}</dt>
            <dd className="font-extrabold text-hoja">{allQuoted ? formatMoney(subtotal + (allDelivered ? fees : 0)) : "—"}</dd>
          </div>
        </dl>
        {fieldError ? <Alert tone="error">{fieldError}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button variant="primary" type="submit" disabled={blocked || pending} className="w-full">
          {confirmLabel}
        </Button>
        <p className="text-xs text-tinta-suave">
          {values.method === "tarjeta"
            ? `Te llevamos a la página segura de Stripe${shipments > 1 ? " para pagar toda la compra de una vez" : ""}. Los datos de tu tarjeta nunca pasan por Rapitrip.`
            : shipments > 1
              ? "Se crea un pedido por cada entrega. Cada comercio tiene 45 minutos para confirmar el suyo."
              : "El comercio tiene 45 minutos para confirmar tu pedido."}
        </p>
      </Card>
    </form>
  );
}

/** Una tienda de la compra: sus envíos (clase, plazo, productos y costo) o, mientras no hay punto, sus productos. */
function StoreSummary({ group, quote, delivery, deliveryError, deliveryLoading, many }: { group: StoreGroup; quote: Quote | null; delivery: DeliveryEntry | null; deliveryError: string | null; deliveryLoading: boolean; many: boolean }) {
  const name = quote?.store?.name ?? group.storeName ?? "Tienda";
  return (
    <section aria-label={`Entrega de ${name}`} className="flex flex-col gap-2.5">
      {many || delivery ? (
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-[13.5px] font-extrabold text-tinta">{name}</h3>
          {many ? (
            <button type="button" onClick={() => updateCart((c) => removeStore(c, group.storeId))} className="shrink-0 text-xs font-bold text-rojo underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-rojo">
              Quitar tienda
            </button>
          ) : null}
        </div>
      ) : null}
      {deliveryError ? <Alert tone="warning">{deliveryError}</Alert> : null}
      {delivery ? (
        delivery.shipments.map((shipment, index) => (
          <div key={index} className="flex flex-col gap-1.5 rounded-2xl border border-borde bg-superficie/70 p-3 text-[13px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Badge tone={shipment.delivery_class === "express" ? "positive" : "neutral"}>{classLabel(shipment)}</Badge>
                <span className="text-tinta-suave">{etaText(shipment)}</span>
              </span>
              <span className="font-bold">{formatMoney(shipment.customer_fee)}</span>
            </div>
            {reasonText(shipment.reason) ? <p className="text-xs text-tinta-suave">{reasonText(shipment.reason)}</p> : null}
            <ul className="flex flex-col gap-1">
              {quote?.lines
                .filter((line) => shipment.items.some((item) => item.variant_id === line.variant_id))
                .map((line) => (
                  <li key={line.variant_id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{line.quantity} × {line.product_name} <span className="text-tinta-suave">({line.variant_name})</span></span>
                    <span className="font-bold">{formatMoney(line.line_total)}</span>
                  </li>
                ))}
            </ul>
            <p className="flex justify-between text-xs text-tinta-suave">
              <span>Productos de este envío</span>
              <span>{formatMoney(shipmentSubtotal(shipment, quote))}</span>
            </p>
          </div>
        ))
      ) : (
        <ul className="flex flex-col gap-1.5 text-[13.5px]">
          {quote?.lines.map((line) => (
            <li key={line.variant_id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{line.quantity} × {line.product_name} <span className="text-tinta-suave">({line.variant_name})</span></span>
              <span className="font-bold">{formatMoney(line.line_total)}</span>
            </li>
          ))}
          {deliveryLoading ? <li className="text-xs text-tinta-suave">Calculando el envío…</li> : null}
        </ul>
      )}
    </section>
  );
}
