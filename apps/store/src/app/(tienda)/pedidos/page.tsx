import { Badge, buttonStyles, Card, EmptyState } from "@rapitrip/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pager } from "@/components/pager";
import { formatMoney } from "@/lib/money";
import { isOrderStatus, orderStatusLabel, orderStatusTone } from "@/lib/orders";
import { buildQuery, parsePage } from "@/lib/search-params";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

export const metadata: Metadata = { title: "Mis pedidos", robots: { index: false } };

const PAGE = 10;
const fecha = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "America/Managua" });

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await requireCustomer("/pedidos");
  const page = parsePage((await searchParams).pagina);
  const supabase = await serverSupabase();
  const { data: profile } = await supabase.from("my_profile").select("id").maybeSingle();
  if (!profile) redirect(`/ingresar?next=${encodeURIComponent("/pedidos")}&expirada=1`);

  const { data, error } = await supabase
    .from("orders_list")
    .select("id, number, store_name, status, total, item_count, created_at")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE);
  if (error) throw new Error("No pudimos cargar tus pedidos.");
  const rows = data ?? [];
  const visible = rows.slice(0, PAGE);

  return (
    <main className="mx-auto max-w-[1176px] px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-tinta">Mis pedidos</h1>
      <p className="mb-6 mt-1 text-[14px] text-tinta-suave">Sigue tus pedidos y repite los que más te gustan.</p>

      {visible.length === 0 ? (
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
          {visible.map((order) => {
            const status = isOrderStatus(order.status) ? order.status : null;
            return (
              <li key={order.id} className="relative">
                <Card className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-extrabold text-tinta">
                      <Link href={`/pedidos/${order.id}`} className="rounded after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-hoja">
                        Pedido {order.number} · {order.store_name}
                      </Link>
                    </h2>
                    <p className="text-[13px] text-tinta-suave">
                      {order.created_at ? fecha.format(new Date(order.created_at)) : ""} · {order.item_count} {order.item_count === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {status ? <Badge tone={orderStatusTone[status]}>{orderStatusLabel[status]}</Badge> : null}
                    <span className="text-[15px] font-extrabold text-hoja">{formatMoney(order.total)}</span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} hasNext={rows.length > PAGE} href={(p) => `/pedidos${buildQuery({ pagina: p })}`} />
    </main>
  );
}
