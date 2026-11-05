import { Alert, Badge, Card, buttonStyles, cn, initials } from "@rapitrip/ui";
import { ArrowLeft, Banknote, Info, MapPin, Package, Phone, ReceiptText, ShieldCheck, Store, Truck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { formatDate } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { formatStoreDateTime, storeState } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { inviteCommerceAccount, setCommerceStatus } from "../actions";
import { ConsoleInvite } from "./console-invite";
import { StatusControl } from "./status-control";

type StoreRow = { id: string; name: string; address: string | null; phone: string | null; fee: number | null; closedUntil: string | null; state: ReturnType<typeof storeState>; published: number; draft: number; orders: number; sales: number };

const DAY_MS = 86_400_000;

/**
 * Ficha de un comercio (empresa con RUC, con una o varias tiendas) o de un vendedor propio (un solo punto de venta, como quien
 * vende en un marketplace; otro punto se pide a la administración). La misma página sirve en /admin/comercios y /admin/vendedores.
 */
export default async function ComercioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * DAY_MS);
  const [commerce, stores, products, accounts, reclass, sales, invitations, request] = await Promise.all([
    supabase.from("commerces_list").select("id, name, status, created_at, kind, ruc").eq("id", id).maybeSingle(),
    supabase.from("stores_list").select("id, name, address, contact_phone, delivery_fee, status, closed_until, open_now").eq("commerce_id", id).order("created_at"),
    supabase.from("products_list").select("id, store_id, status").eq("commerce_id", id),
    supabase.from("accounts_staff").select("full_name, email, role_status").eq("role", "comercio").eq("commerce_id", id),
    supabase.from("commerce_reclassification_stats").select("reclassified, express_total").eq("commerce_id", id).maybeSingle(),
    supabase.rpc("sales_by_store", { p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.from("invitations_list").select("email, status, expires_at").eq("commerce_id", id).eq("status", "pendiente").order("created_at", { ascending: false }).limit(1),
    supabase.from("commerce_requests_list").select("details").eq("commerce_id", id).maybeSingle(),
  ]);
  if (!commerce.data || !commerce.data.id || !commerce.data.name) notFound();
  const failed = stores.error || products.error || accounts.error || sales.error;
  if (failed) console.error("[comercio:detalle]", stores.error?.message, products.error?.message, accounts.error?.message, sales.error?.message);

  const isCompany = commerce.data.kind === "empresa";
  const suspended = commerce.data.status === "suspendido";
  const counts = new Map<string, { published: number; draft: number }>();
  for (const row of products.data ?? []) {
    if (!row.store_id || row.status === "archivado") continue;
    const entry = counts.get(row.store_id) ?? { published: 0, draft: 0 };
    if (row.status === "publicado") entry.published += 1;
    else entry.draft += 1;
    counts.set(row.store_id, entry);
  }
  const salesByStore = new Map((sales.data ?? []).map((row) => [row.store_id, { orders: Number(row.orders ?? 0), sales: Number(row.sales ?? 0) }]));
  const rows: StoreRow[] = (stores.data ?? []).flatMap((row) =>
    row.id && row.name
      ? [{
          id: row.id,
          name: row.name,
          address: row.address,
          phone: row.contact_phone,
          fee: row.delivery_fee === null || row.delivery_fee === undefined ? null : Number(row.delivery_fee),
          closedUntil: row.closed_until && new Date(row.closed_until) > new Date() ? row.closed_until : null,
          state: storeState(row),
          published: counts.get(row.id)?.published ?? 0,
          draft: counts.get(row.id)?.draft ?? 0,
          orders: salesByStore.get(row.id)?.orders ?? 0,
          sales: salesByStore.get(row.id)?.sales ?? 0,
        }]
      : [],
  );
  const owner = accounts.data?.[0];
  const pendingInvite = invitations.data?.[0] ?? null;
  const requestDetails = request.data?.details;
  const requestedEmail = requestDetails && typeof requestDetails === "object" && !Array.isArray(requestDetails) && typeof requestDetails.console_email === "string" ? requestDetails.console_email : "";
  const totals = {
    sales: rows.reduce((sum, row) => sum + row.sales, 0),
    orders: rows.reduce((sum, row) => sum + row.orders, 0),
    published: rows.reduce((sum, row) => sum + row.published, 0),
    open: rows.filter((row) => row.state.tone === "positive").length,
  };
  const name = commerce.data.name;

  return (
    <>
      <Link href={isCompany ? "/admin/comercios" : "/admin/vendedores"} className={buttonStyles({ variant: "ghost", className: "-ml-3 mb-3 min-h-9 px-3 text-[13px]" })}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {isCompany ? "Comercios" : "Vendedores"}
      </Link>
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todos los datos. Recarga la página.</Alert> : null}

      <div className="flex flex-col gap-5">
        {/* Cabecera: quién es, cómo está y lo que vendió en los últimos 30 días. */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-menta to-bruma text-xl font-extrabold text-hoja ring-1 ring-borde">
                {initials(name)}
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={suspended ? "danger" : "positive"}>{suspended ? "Suspendido" : "Activo"}</Badge>
                  <span className="rounded-full bg-lavanda px-2.5 py-0.5 text-[11.5px] font-bold text-marino">{isCompany ? "Comercio · empresa con RUC" : "Vendedor propio"}</span>
                </div>
                <h1 className="truncate text-[24px] font-extrabold leading-tight tracking-tight text-tinta">{name}</h1>
                <p className="mt-0.5 text-[13px] text-tinta-suave">
                  Afiliado desde {formatDate(commerce.data.created_at)}
                  {isCompany && commerce.data.ruc ? <> · RUC <span className="font-mono">{commerce.data.ruc}</span></> : null}
                </p>
              </div>
            </div>
            <dl className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:gap-2.5">
              <Stat label="Ventas 30 días" value={formatMoney(totals.sales)} />
              <Stat label="Pedidos 30 días" value={totals.orders} />
              <Stat label="Publicados" value={totals.published} />
              {isCompany ? <Stat label="Tiendas abiertas" value={`${totals.open} de ${rows.length}`} /> : <Stat label="Punto de venta" value={rows[0] ? rows[0].state.label : "—"} />}
            </dl>
          </div>
        </Card>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-5">{isCompany ? <CompanyStores rows={rows} /> : <SellerPoint rows={rows} />}</div>

          <div className="flex flex-col gap-5 xl:sticky xl:top-6">
            <Card className="p-5">
              <Heading icon={<ShieldCheck className="size-[18px]" />} tone="lavanda" title={isCompany ? "Estado del comercio" : "Estado del vendedor"} />
              <div className="mb-3 flex items-start gap-3 rounded-panel bg-crema/70 p-3.5 ring-1 ring-borde">
                <span aria-hidden="true" className={cn("mt-1 size-2.5 shrink-0 rounded-full", suspended ? "bg-rojo" : "bg-esmeralda")} />
                <div>
                  <p className="text-sm font-bold text-tinta">{suspended ? "Suspendido" : "Activo"}</p>
                  <p className="text-[12.5px] leading-snug text-tinta-suave">
                    {suspended ? "Su cuenta no puede entrar y sus tiendas figuran cerradas. Nada se borra." : "Suspender bloquea el acceso de su cuenta y cierra sus tiendas. Se puede revertir."}
                  </p>
                </div>
              </div>
              <StatusControl id={commerce.data.id} name={name} suspended={suspended} setStatus={setCommerceStatus} noun={isCompany ? "comercio" : "vendedor"} />
            </Card>

            <Card className="p-5">
              <Heading icon={<UserRound className="size-[18px]" />} title={isCompany ? "Cuenta del comercio" : "Cuenta del vendedor"} />
              {owner ? (
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-menta text-sm font-bold text-hoja">{initials(owner.full_name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-tinta">{owner.full_name ?? "Sin nombre"}</p>
                    <p className="truncate text-xs text-tinta-suave">{owner.email}</p>
                  </div>
                  <Badge tone={owner.role_status === "activo" ? "positive" : "warning"}>{owner.role_status === "activo" ? "Activa" : "Suspendida"}</Badge>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pendingInvite ? (
                    <div className="rounded-panel bg-durazno/60 p-3.5 ring-1 ring-borde">
                      <p className="text-sm font-bold text-tinta">Invitación pendiente</p>
                      <p className="text-[12.5px] leading-snug text-tinta-suave">
                        Enviada a <span className="font-semibold text-tinta">{pendingInvite.email}</span>. Vence el {formatDate(pendingInvite.expires_at)}.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-tinta-suave">Todavía no tiene cuenta de consola. Invítala con un correo propio del negocio: su cuenta de la tienda no entra a la consola.</p>
                  )}
                  <ConsoleInvite commerceId={commerce.data.id} defaultEmail={pendingInvite?.email ?? requestedEmail} pending={Boolean(pendingInvite)} invite={inviteCommerceAccount} />
                </div>
              )}
              <Link href="/admin/usuarios" className={buttonStyles({ variant: "secondary", className: "mt-4 w-full" })}>
                Gestionar en Usuarios y roles
              </Link>
            </Card>

            <Card className="p-5">
              <Heading icon={<Truck className="size-[18px]" />} tone="durazno" title="Pedidos express reclasificados" subtitle="Últimos 30 días" />
              {reclass.data && Number(reclass.data.express_total ?? 0) > 0 ? (
                <>
                  <p className="text-[24px] font-extrabold leading-none tabular-nums text-tinta">
                    {Number(reclass.data.reclassified ?? 0)}
                    <span className="text-[14px] font-semibold text-tinta-suave"> de {Number(reclass.data.express_total ?? 0)} express</span>
                  </p>
                  <p className="mt-2 text-[12.5px] leading-snug text-tinta-suave">Pedidos que coordinación pasó a programado porque no cabían en una moto. Si son muchos, revisa cómo clasifica sus productos.</p>
                </>
              ) : (
                <p className="text-[12.5px] text-tinta-suave">Sin pedidos express en los últimos 30 días.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-crema px-3.5 py-2.5">
      <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
      <dd className="whitespace-nowrap text-[15px] font-extrabold tabular-nums text-tinta">{value}</dd>
    </div>
  );
}

function Heading({ icon, title, subtitle, tone = "menta", actions }: { icon: ReactNode; title: string; subtitle?: string; tone?: "menta" | "lavanda" | "durazno"; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", tone === "menta" ? "bg-menta text-hoja" : tone === "lavanda" ? "bg-lavanda text-marino" : "bg-durazno text-durazno-texto")}>
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-tinta">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[12.5px] leading-snug text-tinta-suave">{subtitle}</p> : null}
        </div>
      </div>
      {actions}
    </div>
  );
}

/** Los datos de una tienda o punto de venta: dirección, teléfono, envío, catálogo y ventas. `large` para el punto único del vendedor. */
function StoreCard({ row, large = false }: { row: StoreRow; large?: boolean }) {
  return (
    <article className={cn("flex flex-col gap-3 rounded-panel bg-papel ring-1 ring-borde", large ? "p-5" : "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-xl bg-menta text-hoja", large ? "size-11" : "size-9")}>
            <Store className={large ? "size-5" : "size-[18px]"} />
          </span>
          <h3 className={cn("truncate font-bold text-tinta", large ? "text-[17px]" : "text-[15px]")}>{row.name}</h3>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <Badge tone={row.state.tone}>{row.state.label}</Badge>
          {row.closedUntil ? <span className="text-[11px] text-tinta-suave">hasta {formatStoreDateTime(row.closedUntil)}</span> : null}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 text-[13px] text-tinta-suave">
        <li className="flex items-start gap-2">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {row.address ?? "Sin dirección"}
        </li>
        <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-2">
            <Phone aria-hidden="true" className="size-4 shrink-0" />
            {row.phone ?? "Sin teléfono"}
          </span>
          <span className="flex items-center gap-2">
            <Truck aria-hidden="true" className="size-4 shrink-0" />
            Envío {row.fee === null ? "—" : formatMoney(row.fee)}
          </span>
        </li>
      </ul>
      <dl className={cn("grid gap-2 border-t border-borde pt-3", large ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
        <Mini icon={<Package className="size-3.5" />} label="Publicados" value={row.published} />
        <Mini icon={<Package className="size-3.5" />} label="Borradores" value={row.draft} />
        <Mini icon={<ReceiptText className="size-3.5" />} label="Pedidos 30 d" value={row.orders} />
        {large ? <Mini icon={<Banknote className="size-3.5" />} label="Ventas 30 d" value={formatMoney(row.sales)} /> : null}
      </dl>
      {!large ? (
        <p className="-mt-1 text-[12px] text-tinta-suave">
          Ventas 30 días: <span className="font-bold tabular-nums text-tinta">{formatMoney(row.sales)}</span>
        </p>
      ) : null}
    </article>
  );
}

function Mini({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-micro font-bold uppercase text-tinta-suave">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="text-[15px] font-extrabold tabular-nums text-tinta">{value}</dd>
    </div>
  );
}

/** Comercio: una o varias tiendas en tarjetas; con una sola, la tarjeta ocupa todo el ancho. */
function CompanyStores({ rows }: { rows: StoreRow[] }) {
  return (
    <Card className="p-5 sm:p-6">
      <Heading
        icon={<Store className="size-[18px]" />}
        title="Tiendas"
        subtitle="Solo lectura: las gestiona el comercio desde su consola."
        actions={<span className="rounded-full bg-menta px-2.5 py-1 text-[12px] font-extrabold tabular-nums text-hoja">{rows.length}</span>}
      />
      {rows.length === 0 ? (
        <Empty text="El comercio todavía no ha creado ninguna tienda." />
      ) : (
        <div className={cn("grid grid-cols-1 gap-3", rows.length > 1 && "lg:grid-cols-2")}>
          {rows.map((row) => (
            <StoreCard key={row.id} row={row} large={rows.length === 1} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Vendedor propio: vende desde un único punto. Si la administración le habilitó más, se listan aparte. */
function SellerPoint({ rows }: { rows: StoreRow[] }) {
  const [main, ...extra] = rows;
  return (
    <>
      <Card className="p-5 sm:p-6">
        <Heading icon={<MapPin className="size-[18px]" />} title="Punto de venta" subtitle="Solo lectura: lo gestiona el vendedor desde su consola." />
        {main ? <StoreCard row={main} large /> : <Empty text="El vendedor todavía no ha creado su punto de venta." />}
        <p className="mt-4 flex items-start gap-2 rounded-panel bg-lavanda/60 px-3.5 py-3 text-[12.5px] leading-snug text-tinta">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-marino" />
          Un vendedor propio ofrece sus productos desde un solo punto, como en un marketplace. Si necesita otro, lo solicita y la administración se lo habilita; varias tiendas son propias de un comercio con RUC.
        </p>
      </Card>
      {extra.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <Heading icon={<Store className="size-[18px]" />} tone="durazno" title="Puntos adicionales habilitados" subtitle="Habilitados por la administración a pedido del vendedor." />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {extra.map((row) => (
              <StoreCard key={row.id} row={row} />
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-panel border border-dashed border-borde-campo px-4 py-8 text-center text-[13px] text-tinta-suave">{text}</p>;
}
