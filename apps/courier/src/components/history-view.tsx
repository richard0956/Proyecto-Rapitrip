"use client";

import { Alert, Card, cn, EmptyState } from "@rapitrip/ui";
import { Banknote } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { summarize } from "@/lib/history";
import { formatMoney } from "@/lib/money";
import type { CourierHistoryRow } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { usePolling } from "@/lib/use-polling";
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
      <header>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-tinta">Historial</h1>
        <p className="text-[13.5px] text-tinta-suave">Tus entregas y el efectivo por rendir.</p>
      </header>

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
            className={cn("min-h-11 flex-1 rounded-full text-sm font-bold", days === range.days ? "bg-hoja text-white" : "bg-papel text-tinta shadow-suave")}
          >
            {range.label}
          </button>
        ))}
      </div>

      {error ? <Alert tone="warning">{error}</Alert> : null}
      {!loaded && !error ? (
        <p role="status" className="py-10 text-center text-sm text-tinta-suave">
          Cargando…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs font-bold text-tinta-suave">Entregas</p>
              <p className="text-3xl font-extrabold tabular-nums text-tinta">{summary.deliveries}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-bold text-tinta-suave">Kilómetros</p>
              <p className="text-3xl font-extrabold tabular-nums text-tinta">{summary.km}</p>
            </Card>
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
              {rows.map((row) => (
                <li key={row.order_id}>
                  <Link href={`/pedidos/${row.order_id}`} className="block rounded-concha focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
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
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
