"use client";

import { Alert, Card, cn, EmptyState, KpiCard, pillStyles, Reveal } from "@rapitrip/ui";
import { Banknote, PackageCheck, Route } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { summarize } from "@/lib/history";
import { formatMoney } from "@/lib/money";
import type { CourierHistoryRow } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { usePolling } from "@/lib/use-polling";
import { PageHeader } from "./page-header";
import { LoadingList } from "./skeleton";
import { ClassBadge } from "./status-badge";

const ranges = [
  { days: 1, label: "Hoy" },
  { days: 7, label: "7 días" },
  { days: 31, label: "31 días" },
] as const;
const when = new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Managua" });

/** Sus entregas del periodo y el efectivo que le falta rendir en caja. */
export function HistoryView() {
  const supabase = getSupabase();
  const guard = useAuthGuard();
  const [days, setDays] = useState<number>(7);
  const [rows, setRows] = useState<CourierHistoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: failure } = await supabase.rpc("courier_history", { p_days: days });
    if (failure) {
      if (!guard(failure)) setError(friendlyError(failure, "No pudimos cargar tu historial."));
      return;
    }
    setRows(data ?? []);
    setError(null);
    setLoaded(true);
  }, [supabase, guard, days]);

  usePolling(load, 60_000);
  const summary = useMemo(() => summarize(rows), [rows]);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5">
      <PageHeader eyebrow="Tu actividad" title="Historial" description="Tus entregas y el efectivo por rendir." />

      <div role="group" aria-label="Periodo" className="flex gap-2">
        {ranges.map((range) => (
          <button
            key={range.days}
            type="button"
            aria-pressed={days === range.days}
            onClick={() => {
              setLoaded(false);
              setDays(range.days);
            }}
            className={cn(pillStyles(days === range.days), "min-h-11 flex-1 justify-center text-sm")}
          >
            {range.label}
          </button>
        ))}
      </div>

      {error ? <Alert tone="warning">{error}</Alert> : null}
      {!loaded && !error ? (
        <LoadingList label="Cargando tu historial…" rows={3} height="h-24" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={<PackageCheck className="size-5" />} label="Entregas" value={summary.deliveries} />
            <KpiCard icon={<Route className="size-5" />} tone="lavanda" label="Kilómetros" value={summary.km} />
          </div>

          {summary.cashPending > 0 ? (
            <Alert tone="warning" icon={<Banknote className="size-[18px]" />}>
              <span className="font-bold">Por rendir en caja: {formatMoney(summary.cashPending)}</span> en {summary.cashPendingOrders} pedido{summary.cashPendingOrders === 1 ? "" : "s"}. Entrega el efectivo y el código de cada pedido al cajero.
            </Alert>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState title="Sin entregas en este periodo">Cuando entregues pedidos aparecerán aquí.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row, index) => (
                <li key={row.order_id}>
                  <Reveal index={Math.min(index, 4)}>
                  <Link href={`/pedidos/${row.order_id}`} className="block rounded-concha transition-transform duration-500 ease-fluido active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                    <Card className="flex flex-col gap-1.5 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-extrabold text-tinta">Pedido {row.number}</p>
                        <ClassBadge value={row.delivery_class} />
                      </div>
                      <p className="text-[13.5px] text-tinta">{row.store_name}</p>
                      <p className="text-xs text-tinta-suave">{row.delivered_at ? when.format(new Date(row.delivered_at)) : "—"}{row.distance_km != null ? ` · ${Number(row.distance_km).toFixed(1)} km` : ""}</p>
                      {row.payment_method === "efectivo" ? (
                        <p className={cn("text-xs font-bold", row.cash_received ? "text-hoja" : "text-durazno-texto")}>
                          Efectivo {formatMoney(row.cash_total)} · {row.cash_received ? "recibido en caja" : "por rendir"}
                        </p>
                      ) : null}
                    </Card>
                  </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
