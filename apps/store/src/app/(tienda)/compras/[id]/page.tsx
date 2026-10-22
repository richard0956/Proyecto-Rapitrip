import { Alert, Badge, buttonStyles, Card } from "@rapitrip/ui";
import { CheckCircle2, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { classLabel, etaText } from "@/lib/delivery-class";
import { formatMoney } from "@/lib/money";
import { isOrderStatus, orderStatusLabel, orderStatusTone, remainingText } from "@/lib/orders";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { startCheckoutPayment } from "../../checkout/actions";
import { AutoRefresh } from "../../pedidos/[id]/auto-refresh";
import { PayPurchase } from "./pay-purchase";

export const metadata: Metadata = { title: "Compra realizada", robots: { index: false } };

/** Pantalla de una compra: los pedidos que salieron de ella, uno por cada entrega, y su pago si fue con tarjeta. */
export default async function CompraPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pago?: string }> }) {
  const { id } = await params;
  const { pago } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const here = `/compras/${id}`;
  await requireCustomer(here);
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("id").maybeSingle();
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent(here)}&expirada=1`);

  const [{ data: checkout }, { data: orders, error }] = await Promise.all([
    supabase.from("my_checkouts").select("id, payment_method, total, order_count, created_at, payment_status").eq("id", id).maybeSingle(),
    supabase.from("orders_list").select("id, number, store_name, status, total, delivery_class, eta_min_days, eta_max_days, expires_at").eq("checkout_id", id).order("number"),
  ]);
  if (!checkout) notFound();
  if (error) throw new Error("No pudimos cargar tu compra.");
  const rows = orders ?? [];
  const ids = rows.flatMap((order) => (order.id ? [order.id] : []));
  // Qué trae cada pedido y adónde llega: la dirección es la misma para toda la compra.
  const [{ data: items }, { data: delivery }] = ids.length
    ? await Promise.all([
        supabase.from("order_items_list").select("order_id, product_name, variant_name, quantity").in("order_id", ids),
        supabase.from("order_delivery_list").select("order_id, address, phone").in("order_id", ids).limit(1),
      ])
    : [{ data: [] }, { data: [] }];
  const itemsByOrder = new Map<string, string[]>();
  for (const item of items ?? []) {
    if (!item.order_id || !item.product_name) continue;
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), `${item.quantity} × ${item.product_name}${item.variant_name ? ` · ${item.variant_name}` : ""}`]);
  }
  const address = delivery?.[0];
  const waiting = checkout.payment_status === "pendiente";
  const unpaid = rows.filter((order) => order.status === "pendiente_pago");
  const unpaidTotal = unpaid.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  // Los pedidos de una compra comparten el vencimiento: se muestra el más próximo.
  const left = waiting ? remainingText(unpaid.map((order) => order.expires_at).filter((value): value is string => !!value).sort()[0]) : null;
  const confirming = waiting && pago === "ok";

  return (
    <main className="mx-auto max-w-[760px] px-4 py-8 sm:px-8 sm:py-10">
      {/* Con el pago recién hecho, la pantalla se actualiza sola hasta que Stripe confirme. */}
      {confirming ? <AutoRefresh everyMs={4_000} maxAttempts={15} /> : null}

      <div role="status" className="flex items-start gap-3 rounded-2xl border border-borde bg-white/70 p-5">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-hoja" />
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight text-tinta">Compra realizada</h1>
          <p className="mt-1 text-[14px] text-tinta-suave">
            Creamos {rows.length === 1 ? "1 pedido" : `${rows.length} pedidos`}, uno por cada entrega. Total de la compra: <strong className="text-tinta">{formatMoney(Number(checkout.total ?? 0))}</strong>.
          </p>
        </div>
      </div>

      {address?.address ? (
        <p className="mt-4 flex items-start gap-2 text-[13.5px] text-tinta">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-hoja" />
          <span>
            Se entrega en <strong>{address.address}</strong>
            {address.phone ? <span className="text-tinta-suave"> · Contacto: {address.phone}</span> : null}
          </span>
        </p>
      ) : null}

      {confirming ? <Alert className="mt-4">Recibimos tu pago y lo estamos confirmando. En unos segundos tus pedidos pasan a «Por confirmar».</Alert> : null}
      {waiting && pago === "cancelado" ? <Alert tone="warning" className="mt-4">No completaste el pago. Puedes intentarlo de nuevo mientras la compra siga vigente.</Alert> : null}
      {waiting && pago === "error" ? <Alert tone="warning" className="mt-4">No pudimos abrir la página de pago. Inténtalo de nuevo desde aquí.</Alert> : null}
      {checkout.payment_status === "vencido" ? <Alert tone="warning" className="mt-4">Se acabó el tiempo para pagar y los pedidos sin pago se cancelaron. Puedes hacer la compra de nuevo desde tu carrito.</Alert> : null}
      {checkout.payment_status === "pagado" ? <Alert className="mt-4">Pagaste toda la compra con tarjeta en un solo cobro. Si un pedido se cancela, devolvemos solo su parte.</Alert> : null}

      {waiting && !confirming && unpaid.length > 0 ? (
        <Card outerClassName="mt-4" className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-base font-bold text-tinta">Falta pagar con tarjeta</h2>
            <p className="mt-1 text-[13.5px] text-tinta-suave">
              Pagas {formatMoney(unpaidTotal)} de una vez por {unpaid.length === 1 ? "tu pedido" : `tus ${unpaid.length} pedidos`}.
              {left ? ` Te quedan ${left} para pagar.` : ""}
            </p>
          </div>
          <PayPurchase checkoutId={id} pay={startCheckoutPayment} />
        </Card>
      ) : null}

      <ul className="mt-6 flex flex-col gap-3">
        {rows.map((order) => {
          const status = isOrderStatus(order.status) ? order.status : null;
          const cls = order.delivery_class === "programado" ? ("programado" as const) : ("express" as const);
          return (
            <li key={order.id} className="relative">
              <Card className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-extrabold text-tinta">
                    <Link href={`/pedidos/${order.id}`} className="rounded after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-hoja">
                      Pedido {order.number} · {order.store_name}
                    </Link>
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-tinta-suave">
                    <Badge tone={cls === "express" ? "positive" : "neutral"}>{classLabel({ delivery_class: cls })}</Badge>
                    {etaText({ delivery_class: cls, eta_min_days: order.eta_min_days ?? null, eta_max_days: order.eta_max_days ?? null })}
                  </p>
                  {order.id && itemsByOrder.get(order.id)?.length ? <p className="mt-1 text-[13px] text-tinta-suave">{itemsByOrder.get(order.id)!.join(" · ")}</p> : null}
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  {status ? <Badge tone={orderStatusTone[status]}>{orderStatusLabel[status]}</Badge> : null}
                  <span className="text-[15px] font-extrabold text-hoja">{formatMoney(Number(order.total ?? 0))}</span>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/pedidos" className={buttonStyles({ variant: "primary" })}>
          Ver mis pedidos
        </Link>
        <Link href="/tiendas" className={buttonStyles({ variant: "secondary" })}>
          Seguir comprando
        </Link>
      </div>
    </main>
  );
}
