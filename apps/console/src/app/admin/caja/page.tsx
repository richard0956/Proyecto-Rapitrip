import { Alert, Badge, Card, EmptyState, pillStyles } from "@rapitrip/ui";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Caja y venta" };

export default async function CajaAdminPage({ searchParams }: { searchParams: Promise<{ diferencia?: string }> }) {
  const { diferencia } = await searchParams;
  const onlyDifferences = diferencia === "1";
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [shifts, staff] = await Promise.all([
    supabase
      .from("cash_sessions_list")
      .select("id, cashier_id, opened_at, opening_amount, closed_at, counted_amount, difference, note, sales_count, sales_total, cash_expected")
      .order("opened_at", { ascending: false })
      .limit(60),
    supabase.from("accounts_staff").select("user_id, full_name").eq("role", "cajero"),
  ]);
  const ids = (shifts.data ?? []).flatMap((row) => (row.id ? [row.id] : []));
  const sales = ids.length ? await supabase.from("orders_list").select("number, cash_session_id, store_name, status, payment_method, total, created_at").eq("channel", "mostrador").in("cash_session_id", ids).order("created_at") : { data: [], error: null };
  const failed = shifts.error || staff.error || sales.error;
  if (failed) console.error("[admin:caja]", shifts.error?.message, staff.error?.message, sales.error?.message);

  const names = new Map((staff.data ?? []).flatMap((row) => (row.user_id ? [[row.user_id, row.full_name ?? "Cajero"] as const] : [])));
  const salesBySession = new Map<string, NonNullable<typeof sales.data>>();
  for (const sale of sales.data ?? []) {
    if (!sale.cash_session_id) continue;
    salesBySession.set(sale.cash_session_id, [...(salesBySession.get(sale.cash_session_id) ?? []), sale]);
  }
  const rows = (shifts.data ?? []).filter((row) => row.id && (!onlyDifferences || (row.closed_at && Number(row.difference ?? 0) !== 0)));

  return (
    <>
      <PageHeader title="Caja y venta" description="Turnos de caja y ventas de mostrador de todo el equipo. Los últimos 60 turnos." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/admin/caja" aria-current={!onlyDifferences ? "page" : undefined} className={pillStyles(!onlyDifferences)}>
            Todos los turnos
          </Link>
          <Link href="/admin/caja?diferencia=1" aria-current={onlyDifferences ? "page" : undefined} className={pillStyles(onlyDifferences)}>
            Solo con diferencia
          </Link>
        </div>
        {rows.length === 0 ? (
          <EmptyState title={onlyDifferences ? "Ningún turno con diferencia" : "Sin turnos"}>{onlyDifferences ? "Todos los cierres cuadraron." : "Aparecen cuando el equipo de caja abre su primer turno."}</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => {
              const difference = row.difference === null ? null : Number(row.difference);
              const list = salesBySession.get(row.id!) ?? [];
              return (
                <li key={row.id}>
                  <details className="group rounded-panel bg-calido/50 px-4 py-3 ring-1 ring-borde">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                      <span className="min-w-0">
                        <span className="block font-bold text-tinta">{row.cashier_id ? (names.get(row.cashier_id) ?? "Cajero") : "Cajero"}</span>
                        <span className="block text-xs text-tinta-suave">
                          {formatDateTime(row.opened_at)} · {Number(row.sales_count ?? 0)} {Number(row.sales_count ?? 0) === 1 ? "venta" : "ventas"} · {formatMoney(row.sales_total)}
                        </span>
                      </span>
                      {!row.closed_at ? <Badge tone="warning">Abierto</Badge> : difference === 0 ? <Badge tone="positive">Cuadró</Badge> : <Badge tone="danger">Diferencia {formatMoney(difference)}</Badge>}
                    </summary>
                    <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-tinta-suave">Efectivo inicial</dt>
                      <dd className="tabular-nums">{formatMoney(row.opening_amount)}</dd>
                      <dt className="text-tinta-suave">Efectivo esperado</dt>
                      <dd className="tabular-nums">{formatMoney(row.cash_expected)}</dd>
                      <dt className="text-tinta-suave">Efectivo contado</dt>
                      <dd className="tabular-nums">{row.closed_at ? formatMoney(row.counted_amount) : "—"}</dd>
                    </dl>
                    {row.note ? <p className="mt-2 text-xs text-tinta">Nota del cajero: {row.note}</p> : null}
                    {list.length > 0 ? (
                      <ul className="mt-3 flex flex-col divide-y divide-borde border-t border-borde text-sm">
                        {list.map((sale) => (
                          <li key={sale.number} className="flex items-center justify-between gap-3 py-1.5">
                            <span className="min-w-0 truncate">
                              Venta {sale.number} · {sale.store_name} · {sale.payment_method === "efectivo" ? "efectivo" : "tarjeta"}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className={`tabular-nums ${sale.status === "cancelado" ? "text-tinta-suave line-through" : "text-tinta"}`}>{formatMoney(sale.total)}</span>
                              {sale.status === "cancelado" ? <Badge tone="danger">Anulada</Badge> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
