import { Alert, Card, CardHeader } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { formatMoney } from "@/lib/money";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Liquidaciones" };

/** El comercio ve lo que Rapitrip le debe todavía, su convenio y cada liquidación recibida (Política 9 del manual de políticas de TI). */
export default async function ComercioLiquidacionesPage() {
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const [status, history] = await Promise.all([supabase.rpc("my_settlement_status"), supabase.rpc("settlements_history", {})]);
  if (status.error || history.error) console.error("[comercio:liquidaciones]", status.error?.message, history.error?.message);
  const s = (status.data ?? {}) as { pending_orders?: number; pending_amount?: number; pending_reversals?: number; commission_pct?: number; period_days?: number; return_cost_bearer?: string };
  const pendingAmount = Number(s.pending_amount ?? 0);
  const pendingReversals = Number(s.pending_reversals ?? 0);

  return (
    <>
      <PageHeader title="Liquidaciones" description="Lo que Rapitrip te paga por tus pedidos entregados y cobrados, según tu convenio de afiliación." />
      {status.error || history.error ? <Alert tone="error" className="mb-5">No pudimos cargar tus liquidaciones. Recarga la página.</Alert> : null}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <CardHeader title="Por cobrar" subtitle="Pedidos entregados y cobrados que entran en tu próxima liquidación." />
          <dl className="grid grid-cols-3 gap-2">
            {(
              [
                ["Pedidos", String(s.pending_orders ?? 0)],
                ["Monto", formatMoney(pendingAmount)],
                ["Neto estimado", formatMoney(pendingAmount - pendingReversals)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl bg-crema/70 px-3 py-2.5 ring-1 ring-borde">
                <dt className="text-micro font-bold uppercase text-tinta-suave">{label}</dt>
                <dd className="text-[16px] font-bold tabular-nums text-tinta">{value}</dd>
              </div>
            ))}
          </dl>
          {pendingReversals > 0 ? <p className="mt-3 text-[12.5px] text-tinta-suave">Se descontarán {formatMoney(pendingReversals)} por devoluciones aprobadas de pedidos ya liquidados.</p> : null}
        </Card>
        <Card className="p-5">
          <CardHeader title="Tu convenio" subtitle="Lo fija la administración al afiliarte; pide el cambio si algo no corresponde." />
          <ul className="flex flex-col gap-1.5 text-[13.5px] text-tinta">
            <li>Comisión de Rapitrip: <span className="font-bold">{Number(s.commission_pct ?? 0)} %</span> sobre lo vendido en productos (el envío no entra).</li>
            <li>Liquidación: <span className="font-bold">cada {s.period_days ?? 15} días</span> como máximo.</li>
            <li>Devoluciones: {s.return_cost_bearer === "rapitrip" ? "las asume Rapitrip." : "si un pedido ya liquidado se devuelve, se descuenta en tu siguiente liquidación."}</li>
          </ul>
        </Card>
      </div>
      <Card className="p-5">
        <CardHeader title="Liquidaciones recibidas" />
        {(history.data ?? []).length === 0 ? (
          <p className="text-[13px] text-tinta-suave">Todavía no tienes liquidaciones.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13px]">
              <caption className="sr-only">Liquidaciones recibidas</caption>
              <thead>
                <tr className="text-left text-micro uppercase text-tinta-suave">
                  {["N.°", "Fecha", "Pedidos", "Vendido", "Comisión", "Reversiones", "Neto", "Referencia"].map((h) => (
                    <th key={h} className="pb-2 pr-3 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(history.data ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-borde">
                    <td className="py-2 pr-3 font-bold tabular-nums">{row.number}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.orders_count}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatMoney(row.gross)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatMoney(row.commission)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatMoney(row.reversals)}</td>
                    <td className="py-2 pr-3 font-bold tabular-nums">{formatMoney(row.net)}</td>
                    <td className="py-2 pr-3 text-tinta-suave">{row.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
