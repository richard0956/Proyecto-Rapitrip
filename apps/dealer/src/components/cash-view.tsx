"use client";

import { Alert, Button, cn, Reveal } from "@rapitrip/ui";
import { ArrowLeft, Banknote, Clock, Landmark, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { lastMessage, parseCashStatus, type CashPending, type CashStatus } from "@/lib/cash";
import { getSupabase } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import { formatCountdown } from "@/lib/offers";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { useCountdown } from "@/lib/use-countdown";
import { usePolling } from "@/lib/use-polling";
import { GreenPanel, PanelTag, SectionTitle, Tray, WarmEmpty } from "./panel";
import { Skeleton } from "./skeleton";

const POLL_MS = 10_000;
const HANDED_OVER = "Avisamos a la caja. Entrega el efectivo al cajero para que lo cuente.";
type Point = { sessionId: string; register: string; code: string | null; cashier: string };

const hourFormat = new Intl.DateTimeFormat("es-NI", { hour: "numeric", minute: "2-digit", timeZone: "America/Managua" });
const hour = (iso: string) => (iso ? hourFormat.format(new Date(iso)) : "");

/** Cuenta regresiva de la entrega: el cajero tiene estos minutos para contar y confirmar. */
function Waiting({ pending, minutes }: { pending: CashPending; minutes: number }) {
  const left = useCountdown(pending.expiresAt);
  const total = Math.max(1, minutes * 60);
  return (
    <section aria-labelledby="esperando" className="flex flex-col gap-3 rounded-[1.75rem] bg-superficie p-4 ring-1 ring-hoja/30">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-menta text-hoja">
          <Clock className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="esperando" className="text-[16px] font-bold text-tinta">
            Esperando al cajero
          </h2>
          <p className="text-[13px] text-tinta-suave">
            {pending.register} · {formatMoney(pending.declared)}
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 font-mono text-[15px] font-extrabold tabular-nums", left <= 0 ? "bg-rosa text-rojo" : left <= 300 ? "bg-durazno text-durazno-texto" : "bg-menta text-hoja")} aria-live="polite">
          {left <= 0 ? "Venció" : formatCountdown(left)}
        </span>
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-crema">
        <div className="h-full rounded-full bg-hoja transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      </div>
      <p className="text-[13px] text-tinta">Dale el efectivo al cajero. Él lo cuenta y escribe el monto. Hasta que lo confirme, el efectivo sigue a tu cargo.</p>
    </section>
  );
}

/**
 * Efectivo a cargo del repartidor: cuánto lleva, de qué pedidos, y el botón «Efectivo entregado» para avisar a una caja
 * abierta. El cajero de esa caja cuenta y confirma en un tiempo límite; si no, el efectivo sigue a cargo del repartidor.
 */
export function CashView() {
  const supabase = getSupabase();
  const guard = useAuthGuard();
  const [status, setStatus] = useState<CashStatus | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [notice, setNotice] = useState<{ tone: "info" | "warning" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [cash, open] = await Promise.all([supabase.rpc("courier_cash_status"), supabase.rpc("open_cash_points")]);
    const failure = cash.error ?? open.error;
    if (failure) {
      if (guard(failure)) return;
      return setNotice({ tone: "warning", text: friendlyError(failure, "No pudimos actualizar. Reintentamos solos.") });
    }
    const next = parseCashStatus(cash.data);
    setStatus(next);
    const list = (open.data ?? []).map((row) => ({ sessionId: row.session_id, register: row.register_name, code: row.register_code ?? null, cashier: row.cashier_name }));
    setPoints(list);
    setSessionId((current) => (list.some((point) => point.sessionId === current) ? current : (list[0]?.sessionId ?? "")));
    // El aviso de «avisamos a la caja» se va cuando el cajero resuelve la entrega: desde ahí habla el resultado.
    setNotice((current) => (current?.tone === "warning" || (current?.text === HANDED_OVER && !next.pending) ? null : current));
  }, [supabase, guard]);

  usePolling(load, POLL_MS);

  async function handOver() {
    if (!sessionId) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc("courier_start_cash_handoff", { p_session: sessionId });
    if (error) {
      if (!guard(error)) setNotice({ tone: "error", text: friendlyError(error) });
    } else {
      setNotice({ tone: "info", text: HANDED_OVER });
    }
    await load();
    setBusy(false);
  }

  if (!status) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6">
        <p role="status" className="sr-only">
          Cargando tu efectivo…
        </p>
        <Skeleton className="h-48 rounded-[2rem]" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const free = status.orders.filter((order) => !order.inHandoff);
  const message = status.last ? lastMessage(status.last) : null;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <Reveal>
        <GreenPanel labelledBy="titulo-efectivo">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              aria-label="Volver al inicio"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors duration-500 ease-fluido hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </Link>
            <PanelTag icon={<Wallet className="size-3.5" />}>Tu efectivo</PanelTag>
          </div>
          <h1 id="titulo-efectivo" className="mt-4 text-[15px] font-semibold text-white/80">
            Efectivo a tu cargo
          </h1>
          <p className="font-titulo text-[40px] font-extrabold leading-none tabular-nums tracking-tight">{formatMoney(status.total)}</p>
          <p className="mt-2 text-[13px] text-white/75">
            Entrégalo en caja antes de {status.maxHoldHours} {status.maxHoldHours === 1 ? "hora" : "horas"} o de pasar {formatMoney(status.maxHoldAmount)}. El cajero tiene {status.confirmMinutes} minutos para confirmarlo.
          </p>
        </GreenPanel>
      </Reveal>

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      {status.block ? <Alert tone="warning">No recibirás pedidos en efectivo hasta entregar lo que llevas: {status.block.replace(/^el repartidor tiene/, "tienes")}.</Alert> : null}
      {message && !status.pending ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {status.openItems > 0 ? <Alert tone="info">Tienes {status.openItems === 1 ? "una falta de efectivo" : `${status.openItems} faltas de efectivo`} en revisión por administración.</Alert> : null}

      {status.pending ? <Waiting pending={status.pending} minutes={status.confirmMinutes} /> : null}

      {!status.pending && free.length > 0 ? (
        <Tray>
          <section aria-labelledby="entregar" className="flex flex-col gap-3">
            <SectionTitle id="entregar" title="Entregar en caja" text="Toca el botón cuando estés frente al cajero." />
            {points.length === 0 ? (
              <Alert tone="warning">No hay ninguna caja abierta ahora. Vuelve a intentarlo cuando un cajero abra su turno.</Alert>
            ) : (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 px-1 text-[13px] font-bold text-tinta">¿En qué caja estás?</legend>
                  {points.map((point) => (
                    <label key={point.sessionId} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2.5 ring-1 transition-colors", sessionId === point.sessionId ? "bg-menta ring-hoja" : "bg-crema ring-transparent")}>
                      <input type="radio" name="caja" value={point.sessionId} checked={sessionId === point.sessionId} onChange={() => setSessionId(point.sessionId)} className="size-4 accent-hoja" />
                      <Landmark aria-hidden="true" className="size-5 text-hoja" />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-bold text-tinta">{point.register}</span>
                        <span className="block text-[12px] text-tinta-suave">
                          {point.code ? `${point.code} · ` : ""}atiende {point.cashier}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <Button variant="primary" className="min-h-14 text-[16px]" onClick={handOver} disabled={busy || !sessionId}>
                  <Banknote className="size-5" aria-hidden="true" />
                  {busy ? "Avisando…" : `Efectivo entregado · ${formatMoney(free.reduce((sum, order) => sum + order.amount, 0))}`}
                </Button>
              </>
            )}
          </section>
        </Tray>
      ) : null}

      <Tray>
        <section aria-labelledby="pedidos-efectivo" className="flex flex-col gap-3">
          <SectionTitle id="pedidos-efectivo" title="Pedidos cobrados" count={status.orders.length} />
          {status.orders.length === 0 ? (
            <WarmEmpty icon={<Wallet className="size-7" />} title="No llevas efectivo">
              Todo lo que cobraste ya está en caja.
            </WarmEmpty>
          ) : (
            <ul className="flex flex-col gap-2">
              {status.orders.map((order) => (
                <li key={order.orderId} className="flex items-center justify-between gap-3 rounded-2xl bg-crema px-3.5 py-3">
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold text-tinta">Pedido {order.number}</span>
                    <span className="block truncate text-[12px] text-tinta-suave">
                      {order.store} · entregado {hour(order.deliveredAt)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[15px] font-extrabold tabular-nums text-tinta">{formatMoney(order.amount)}</span>
                    {order.inHandoff ? <span className="block text-[11px] font-bold text-hoja">En caja, por confirmar</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Tray>
    </div>
  );
}
