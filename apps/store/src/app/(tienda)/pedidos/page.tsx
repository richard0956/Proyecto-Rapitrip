import { buttonStyles, EmptyState } from "@rapitrip/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pager } from "@/components/pager";
import { buildUnits, ordersFilter, type ListedOrder } from "@/lib/purchases";
import { buildQuery, parsePage } from "@/lib/search-params";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";
import { OrderUnitCard } from "./order-unit-card";

export const metadata: Metadata = { title: "Mis pedidos", robots: { index: false } };

const PAGE = 10;

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await requireCustomer("/pedidos");
  const page = parsePage((await searchParams).pagina);
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("id").maybeSingle();
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent("/pedidos")}&expirada=1`);

  // La lista se pagina por compra (o pedido suelto) para no partir una compra entre dos páginas.
  const { data: unitRows, error } = await supabase
    .from("my_order_units")
    .select("unit_id, checkout_id, created_at, order_count, total, payment_status")
    .order("created_at", { ascending: false })
    .order("unit_id")
    .range((page - 1) * PAGE, page * PAGE);
  if (error) throw new Error("No pudimos cargar tus pedidos.");
  const rows = unitRows ?? [];
  const visible = rows.slice(0, PAGE);

  const filter = ordersFilter(visible);
  const { data: orderRows, error: ordersError } = filter
    ? await supabase.from("orders_list").select("id, number, checkout_id, store_name, status, total, item_count, created_at, delivery_class, eta_min_days, eta_max_days").or(filter)
    : { data: [], error: null };
  if (ordersError) throw new Error("No pudimos cargar tus pedidos.");

  const orders: ListedOrder[] = (orderRows ?? []).flatMap((row) =>
    row.id && row.number !== null && row.status
      ? [
          {
            id: row.id,
            number: Number(row.number),
            checkout_id: row.checkout_id,
            store_name: row.store_name ?? "",
            status: row.status,
            total: Number(row.total ?? 0),
            item_count: Number(row.item_count ?? 0),
            created_at: row.created_at,
            delivery_class: row.delivery_class === "programado" ? ("programado" as const) : ("express" as const),
            eta_min_days: row.eta_min_days,
            eta_max_days: row.eta_max_days,
          },
        ]
      : [],
  );
  const units = buildUnits(visible, orders);

  return (
    <main className="mx-auto max-w-[1180px]">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta">Mis pedidos</h1>
      <p className="mb-6 mt-1 text-[14px] text-tinta-suave">Sigue tus compras y tus pedidos, y repite los que más te gustan.</p>

      {units.length === 0 ? (
        <EmptyState title="Aún no tienes pedidos">
          Cuando hagas uno lo verás aquí.
          <span className="mt-4 block">
            <Link href="/tiendas" className={buttonStyles({ variant: "primary" })}>
              Ver tiendas
            </Link>
          </span>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {units.map((unit) => (
            <OrderUnitCard key={unit.id} unit={unit} />
          ))}
        </ul>
      )}
      <Pager page={page} hasNext={rows.length > PAGE} href={(p) => `/pedidos${buildQuery({ pagina: p })}`} />
    </main>
  );
}
