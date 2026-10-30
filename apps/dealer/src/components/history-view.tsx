"use client";

import { Alert, cn, Reveal } from "@rapitrip/ui";
import { ArrowUpRight, Banknote, CheckCheck, History, PackageCheck, Route } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { summarize } from "@/lib/history";
import { formatMoney } from "@/lib/money";
import type { CourierHistoryRow } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { usePolling } from "@/lib/use-polling";
import { GreenPanel, PanelStat, PanelTag, SectionTitle, Tray, WarmEmpty } from "./panel";
import { LoadingList } from "./skeleton";
import { ClassBadge } from "./status-badge";

const ranges = [
  { days: 1, label: "Hoy" },
  { days: 7, label: "7 días" },
  { days: 31, label: "31 días" },
] as const;
const cordobas = new Intl.NumberFormat("es-NI", { maximumFractionDigits: 0 });
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
  // El sondeo solo vuelve a cargar cada minuto: al cambiar de periodo se carga en el acto (no en el montaje, que ya lo hace el sondeo).
  const shownDays = useRef(days);
  useEffect(() => {
    if (shownDays.current === days) return;
    shownDays.current = days;
    void load();
  }, [days, load]);
  const summary = useMemo(() => summarize(rows), [rows]);

  const range = ranges.find((item) => item.days === days)?.label ?? "";

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <Reveal>
        <GreenPanel labelledBy="titulo-historial">
          <PanelTag icon={<History aria-hidden="true" className="size-3.5" />}>Tu actividad</PanelTag>
          <h1 id="titulo-historial" className="mt-4 text-[30px] font-extrabold leading-tight tracking-tight">
            Historial
          </h1>
          <p className="mt-1 text-[14px] text-white/80">Tus entregas y el efectivo por rendir.</p>

          {/* Periodo: control segmentado de cristal, la opción activa en blanco como la píldora «Empezar» del inicio. */}
          <div role="group" aria-label="Periodo" className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-white/[0.07] p-1 ring-1 ring-white/10">
            {ranges.map((item) => (
              <button
                key={item.days}
                type="button"
                aria-pressed={days === item.days}
                onClick={() => {
                  if (item.days === days) return;
                  setLoaded(false);
                  setDays(item.days);
                }}
                className={cn(
                  "min-h-11 rounded-full text-[14px] font-bold transition-[background-color,color,transform] duration-500 ease-fluido active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  days === item.days ? "bg-superficie text-selva shadow-pulsa" : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <ul className="mt-3 grid grid-cols-3 gap-2.5" aria-busy={!loaded}>
            <PanelStat icon={<PackageCheck className="size-3.5" />} label="Entregas" value={loaded ? summary.deliveries : "—"} />
            <PanelStat icon={<Route className="size-3.5" />} label="Kilómetros" value={loaded ? summary.km : "—"} />
            <PanelStat icon={<Banknote className="size-3.5" />} label="Por rendir" value={loaded ? <span className="text-[18px]">C$ {cordobas.format(summary.cashPending)}</span> : "—"} />
          </ul>
        </GreenPanel>
      </Reveal>

      {error ? <Alert tone="warning">{error}</Alert> : null}
      {!loaded && !error ? (
        <LoadingList label="Cargando tu historial…" rows={3} height="h-24" />
      ) : loaded ? (
        <>
          {summary.cashPending > 0 ? (
            <Reveal>
              <CashPending amount={summary.cashPending} orders={summary.cashPendingOrders} />
            </Reveal>
          ) : null}

          <Tray>
            <section aria-labelledby="entregas" className="flex flex-col gap-3">
              <SectionTitle id="entregas" title="Entregas" text={rows.length > 0 ? `${range}. Toca una para ver su detalle.` : undefined} count={rows.length} />
              {rows.length === 0 ? (
                <WarmEmpty icon={<PackageCheck className="size-7" />} title="Sin entregas en este periodo">
                  Cuando entregues pedidos aparecerán aquí.
                </WarmEmpty>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {rows.map((row, index) => (
                    <li key={row.order_id}>
                      <Reveal index={Math.min(index, 4)}>
                        <HistoryRow row={row} />
                      </Reveal>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Tray>
        </>
      ) : null}
    </div>
  );
}

/** Efectivo cobrado que el cajero todavía no recibió: tarjeta durazno con la forma de los avisos del inicio. */
function CashPending({ amount, orders }: { amount: number; orders: number }) {
  return (
    <section aria-labelledby="por-rendir" className="flex items-center gap-3.5 rounded-[1.75rem] bg-superficie p-4 shadow-[0_18px_40px_-30px_rgb(6_54_42/0.45)] ring-1 ring-selva/[0.06]">
      <span aria-hidden="true" className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-durazno text-durazno-texto">
        <Banknote className="size-6" />
        <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full bg-naranja ring-2 ring-superficie motion-reduce:animate-none" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="por-rendir" className="text-[15px] font-bold text-tinta">
          Por rendir en caja: {formatMoney(amount)}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-tinta-suave">
          En {orders} pedido{orders === 1 ? "" : "s"}. Entrega el efectivo y el código de cada pedido al cajero.
        </p>
      </div>
    </section>
  );
}

/** Una entrega del periodo, plana sobre la bandeja como las filas de pedido del inicio. Toda la fila es el enlace al detalle. */
function HistoryRow({ row }: { row: CourierHistoryRow }) {
  const cash = row.payment_method === "efectivo";
  return (
    <Link
      href={`/pedidos/${row.order_id}`}
      className="group flex items-center gap-3 rounded-[1.5rem] bg-crema p-3 ring-1 ring-selva/[0.05] transition-[background-color,transform] duration-500 ease-fluido hover:bg-menta/50 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
    >
      <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center self-start rounded-2xl bg-menta text-hoja">
        <CheckCheck className="size-[22px]" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[15px] font-extrabold text-tinta">Pedido {row.number}</p>
          <ClassBadge value={row.delivery_class} />
        </div>
        <p className="truncate text-[13.5px] font-semibold text-tinta">{row.store_name}</p>
        <p className="text-[12.5px] text-tinta-suave">
          {row.delivered_at ? when.format(new Date(row.delivered_at)) : "—"}
          {row.distance_km != null ? ` · ${Number(row.distance_km).toFixed(1)} km` : ""}
        </p>
        {cash ? (
          <p className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold", row.cash_received ? "bg-menta text-hoja" : "bg-durazno text-durazno-texto")}>
            <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">Efectivo </span>
            {formatMoney(row.cash_total)} · {row.cash_received ? "rendido" : "por rendir"}
          </p>
        ) : null}
      </div>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-superficie text-selva shadow-[0_8px_18px_-12px_rgb(6_54_42/0.5)] transition-transform duration-500 ease-fluido group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
        <ArrowUpRight className="size-5" />
      </span>
    </Link>
  );
}
