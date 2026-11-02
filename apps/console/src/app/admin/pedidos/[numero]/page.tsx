import { Alert, Badge, Card, buttonStyles, cn } from "@rapitrip/ui";
import { ArrowLeft, Banknote, ClipboardList, History, MapPin, Package, Phone, ShieldAlert, Store, StickyNote, Truck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { orderStatusLabel, orderStatusTone, orderStatuses, paymentLabel, type OrderStatus } from "@/lib/orders";
import { formatStoreDateTime } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { cancelOrder, orderRoute, orderTrace } from "../actions";
import { CancelOrderButton, RouteSection, TraceSection } from "./order-detail";

const closed: OrderStatus[] = ["entregado", "cancelado", "rechazado"];

/** Ficha de un pedido o venta de mostrador: qué se pidió, a dónde va, quién lo lleva, cómo se pagó y su historial. */
export default async function PedidoAdminPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  if (!/^\d{1,9}$/.test(numero)) notFound();
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const order = await supabase
    .from("orders_list")
    .select("id, number, channel, store_name, status, payment_method, payment_status, subtotal, delivery_fee, total, item_count, courier_id, cashier_id, status_reason, created_at")
    .eq("number", Number(numero))
    .maybeSingle();
  if (order.error) console.error("[admin:pedido]", order.error.message);
  const row = order.data;
  const status = orderStatuses.find((value): value is OrderStatus => value === row?.status);
  if (!order.error && (!row?.id || !status)) notFound();

  const id = row?.id ?? "";
  const [delivery, items, courier, cashier] = row?.id
    ? await Promise.all([
        supabase.from("order_delivery_list").select("address, phone, notes").eq("order_id", id).maybeSingle(),
        supabase.from("order_items_list").select("product_name, variant_name, quantity, line_total").eq("order_id", id),
        row.courier_id ? supabase.from("couriers_list").select("full_name, phone").eq("id", row.courier_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        row.cashier_id ? supabase.from("accounts_staff").select("full_name").eq("user_id", row.cashier_id).eq("role", "cajero").maybeSingle() : Promise.resolve({ data: null, error: null }),
      ])
    : [{ data: null, error: null }, { data: [], error: null }, { data: null, error: null }, { data: null, error: null }];
  const failed = order.error || delivery.error || items.error || courier.error || cashier.error;
  if (failed) console.error("[admin:pedido]", delivery.error?.message, items.error?.message, courier.error?.message, cashier.error?.message);

  const isCounter = row?.channel === "mostrador";
  const title = `${isCounter ? "Venta" : "Pedido"} ${numero}`;
  const lines = (items.data ?? []).flatMap((item) => (item.product_name ? [{ name: item.product_name, variant: item.variant_name, quantity: Number(item.quantity ?? 0), total: Number(item.line_total ?? 0) }] : []));
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const canCancel = !isCounter && status !== undefined && !closed.includes(status);

  return (
    <>
      <Link href="/admin/pedidos" className={buttonStyles({ variant: "ghost", className: "-ml-3 mb-3 min-h-9 px-3 text-[13px]" })}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Pedidos
      </Link>
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo el pedido. Recarga la página.</Alert> : null}

      {row && status ? (
        <div className="flex flex-col gap-5">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span aria-hidden="true" className={cn("flex size-16 shrink-0 items-center justify-center rounded-2xl ring-1 ring-borde", isCounter ? "bg-lavanda text-marino" : "bg-gradient-to-br from-menta to-bruma text-hoja")}>
                  {isCounter ? <Store className="size-7" /> : <Truck className="size-7" />}
                </span>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={orderStatusTone[status]}>{orderStatusLabel[status]}</Badge>
                    <span className="rounded-full bg-crema px-2.5 py-0.5 text-[11.5px] font-bold text-tinta-suave ring-1 ring-borde">{isCounter ? "Venta de mostrador" : "Tienda web"}</span>
                  </div>
                  <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-tinta">{title}</h1>
                  <p className="truncate text-[13px] text-tinta-suave">
                    {row.store_name} · {formatStoreDateTime(row.created_at)}
                  </p>
                </div>
              </div>
              <dl className="grid shrink-0 grid-cols-3 gap-2 lg:flex lg:gap-2.5">
                <Stat label="Total" value={formatMoney(Number(row.total ?? 0))} strong />
                <Stat label="Productos" value={`${units} u.`} />
                <Stat label="Pago" value={paymentLabel(row.payment_method, row.payment_status)} />
              </dl>
            </div>
          </Card>

          {row.status_reason ? (
            <Alert tone="warning" icon={<ShieldAlert className="size-[18px]" />}>
              <span className="font-bold">Motivo: </span>
              {row.status_reason}
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-5">
              <Card className="p-5 sm:p-6">
                <Heading icon={<Package className="size-[18px]" />} title="Productos" subtitle={`${lines.length} ${lines.length === 1 ? "línea" : "líneas"} · ${units} ${units === 1 ? "unidad" : "unidades"}`} />
                <ul className="flex flex-col divide-y divide-borde rounded-panel bg-papel ring-1 ring-borde">
                  {lines.map((line, index) => (
                    <li key={`${line.name}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-crema text-[12.5px] font-extrabold tabular-nums text-tinta">{line.quantity}×</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-tinta">{line.name}</span>
                          {line.variant ? <span className="block truncate text-xs text-tinta-suave">{line.variant}</span> : null}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums text-tinta">{formatMoney(line.total)}</span>
                    </li>
                  ))}
                  {lines.length === 0 ? <li className="px-4 py-6 text-center text-[13px] text-tinta-suave">Sin productos registrados.</li> : null}
                </ul>
                <dl className="ml-auto mt-4 grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-tinta-suave">Subtotal</dt>
                  <dd className="text-right tabular-nums">{formatMoney(Number(row.subtotal ?? 0))}</dd>
                  <dt className="text-tinta-suave">Envío</dt>
                  <dd className="text-right tabular-nums">{formatMoney(Number(row.delivery_fee ?? 0))}</dd>
                  <dt className="border-t border-borde pt-1.5 font-bold text-tinta">Total</dt>
                  <dd className="border-t border-borde pt-1.5 text-right text-[16px] font-extrabold tabular-nums text-tinta">{formatMoney(Number(row.total ?? 0))}</dd>
                </dl>
              </Card>

              {!isCounter ? (
                <Card className="p-5 sm:p-6">
                  <Heading icon={<MapPin className="size-[18px]" />} tone="lavanda" title="Entrega" subtitle="A dónde va y por dónde." />
                  {delivery.data?.address ? (
                    <div className="mb-4 grid grid-cols-1 gap-2.5 rounded-panel bg-crema/70 p-4 text-sm ring-1 ring-borde sm:grid-cols-2">
                      <p className="flex items-start gap-2 text-tinta sm:col-span-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-tinta-suave" aria-hidden="true" />
                        {delivery.data.address}
                      </p>
                      <p className="flex items-center gap-2 text-tinta">
                        <Phone className="size-4 shrink-0 text-tinta-suave" aria-hidden="true" />
                        {delivery.data.phone ?? "Sin teléfono"}
                      </p>
                      {delivery.data.notes ? (
                        <p className="flex items-start gap-2 text-tinta-suave">
                          <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          {delivery.data.notes}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mb-4 text-[13px] text-tinta-suave">Sin dirección registrada.</p>
                  )}
                  {delivery.data?.address ? <RouteSection orderId={id} load={orderRoute} /> : null}
                </Card>
              ) : null}

              {!isCounter ? (
                <Card className="p-5 sm:p-6">
                  <Heading icon={<History className="size-[18px]" />} tone="durazno" title="Historial y evidencias" subtitle="Cada cambio de estado, las fotos de recogida y entrega y el cobro." />
                  <TraceSection orderId={id} load={orderTrace} />
                </Card>
              ) : null}
            </div>

            <div className="flex flex-col gap-5 xl:sticky xl:top-6">
              <Card className="p-5">
                <Heading icon={<UserRound className="size-[18px]" />} title={isCounter ? "Cajero" : "Repartidor"} />
                {isCounter ? (
                  <Person name={cashier.data?.full_name ?? null} empty="Cajero no identificado" />
                ) : (
                  <Person name={courier.data?.full_name ?? null} detail={courier.data?.phone ?? null} empty="Sin asignar" />
                )}
              </Card>
              <Card className="p-5">
                <Heading icon={<Banknote className="size-[18px]" />} tone="lavanda" title="Pago" />
                <p className="text-sm font-bold text-tinta">{paymentLabel(row.payment_method, row.payment_status)}</p>
                <p className="mt-1 text-[12.5px] text-tinta-suave">{row.payment_method === "efectivo" ? "Se cobra al entregar o en caja." : "Cobro con tarjeta por la pasarela de pago."}</p>
              </Card>
              {canCancel ? (
                <Card className="p-5">
                  <Heading icon={<ClipboardList className="size-[18px]" />} tone="durazno" title="Acciones" subtitle="Solo como excepción: el pedido queda cancelado con su motivo." />
                  <CancelOrderButton id={id} number={Number(numero)} cancel={cancelOrder} />
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-3.5 py-2.5", strong ? "bg-menta" : "bg-crema")}>
      <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
      <dd className={cn("whitespace-nowrap font-extrabold tabular-nums text-tinta", strong ? "text-[17px]" : "text-[13.5px]")}>{value}</dd>
    </div>
  );
}

function Person({ name, detail, empty }: { name: string | null; detail?: string | null; empty: string }) {
  if (!name) return <p className="rounded-panel border border-dashed border-borde-campo px-4 py-4 text-center text-[13px] font-semibold text-tinta-suave">{empty}</p>;
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-sm font-bold text-hoja">
        {name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-tinta">{name}</p>
        {detail ? <p className="truncate text-xs text-tinta-suave">{detail}</p> : null}
      </div>
    </div>
  );
}

function Heading({ icon, title, subtitle, tone = "menta" }: { icon: ReactNode; title: string; subtitle?: string; tone?: "menta" | "lavanda" | "durazno" }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", tone === "menta" ? "bg-menta text-hoja" : tone === "lavanda" ? "bg-lavanda text-marino" : "bg-durazno text-durazno-texto")}>
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-tinta">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[12.5px] leading-snug text-tinta-suave">{subtitle}</p> : null}
      </div>
    </div>
  );
}
