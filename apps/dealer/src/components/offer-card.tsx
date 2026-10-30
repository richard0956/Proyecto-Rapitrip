"use client";

import { Alert, Button, cn, Dialog, Field } from "@rapitrip/ui";
import { Banknote, Check, MapPin, Package, Route } from "lucide-react";
import { useState } from "react";
import { departmentName } from "@/lib/department";
import { formatCountdown, rejectReasons } from "@/lib/offers";
import { formatMoney } from "@/lib/money";
import type { CourierOffer } from "@/lib/types";
import { useCountdown } from "@/lib/use-countdown";
import { ClassBadge } from "./status-badge";

type Props = {
  offer: CourierOffer;
  busy: boolean;
  onAccept: () => void;
  onReject: (reason: string | null) => void;
};

function Detail({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-crema px-3 py-2.5">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-menta text-hoja">
        {icon}
      </span>
      <span className="min-w-0 flex-1 pt-1">{children}</span>
    </li>
  );
}

/** La propuesta abierta: de dónde sale, cuánto paga, si cobra, y una cuenta regresiva. Dos botones grandes: aceptar o rechazar. */
export function OfferCard({ offer, busy, onAccept, onReject }: Props) {
  const left = useCountdown(offer.expires_at);
  const [rejecting, setRejecting] = useState(false);
  const [choice, setChoice] = useState<string>(rejectReasons[0]);
  const [other, setOther] = useState("");
  const expired = left <= 0;
  const urgent = left > 0 && left <= 30;
  const total = Math.max(1, Math.round((new Date(offer.expires_at).getTime() - new Date(offer.offered_at).getTime()) / 1000));
  const remaining = Math.min(1, left / total);
  const reason = choice === "Otro motivo" ? other.trim() : choice;
  const reasonValid = reason.length === 0 || (reason.length >= 5 && reason.length <= 200);

  return (
    <section aria-labelledby="propuesta" aria-live="polite" className="flex flex-col gap-4 rounded-[2rem] bg-superficie p-4 shadow-flota ring-2 ring-esmeralda/70">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="propuesta" className="inline-flex items-center gap-2 text-[18px] font-bold tracking-tight text-tinta">
          <span aria-hidden="true" className="relative flex size-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-esmeralda/60 motion-reduce:hidden" />
            <span className="relative size-2.5 rounded-full bg-esmeralda" />
          </span>
          Nueva propuesta
        </h2>
        <ClassBadge value={offer.delivery_class} />
      </div>

      {/* Bloque oscuro como el héroe del inicio: cuánto paga y cuánto tiempo queda para decidir. */}
      <div className="relative isolate overflow-clip rounded-[1.5rem] bg-[linear-gradient(160deg,var(--panel)_0%,#0d5644_100%)] p-4 text-white">
        <div aria-hidden="true" className="absolute -right-16 -top-20 -z-10 size-48 rounded-full bg-esmeralda/25 blur-3xl" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-white/70">Te pagan</p>
            <p className="mt-1 font-titulo text-[36px] font-extrabold leading-none tracking-tight tabular-nums">{formatMoney(offer.courier_pay)}</p>
          </div>
          <p
            className={cn("shrink-0 rounded-full px-3 py-1.5 font-mono text-[15px] font-extrabold tabular-nums ring-1 transition-colors duration-500 ease-fluido", urgent || expired ? "bg-rosa text-rojo ring-rosa" : "bg-white/10 text-esmeralda ring-white/15")}
            aria-label={expired ? "La propuesta venció" : `Quedan ${formatCountdown(left)}`}
          >
            {expired ? "Venció" : formatCountdown(left)}
          </p>
        </div>
        {offer.cash_total != null ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-durazno px-3 py-1 text-[12.5px] font-bold text-durazno-texto">
            <Banknote aria-hidden="true" className="size-3.5" />
            Cobras {formatMoney(offer.cash_total)} en efectivo
          </p>
        ) : null}
        <div aria-hidden="true" className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full origin-left rounded-full transition-transform duration-1000 ease-fluido", urgent ? "bg-rojo" : "bg-esmeralda")} style={{ transform: `scaleX(${expired ? 0 : remaining})` }} />
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-[14px] text-tinta">
        <Detail icon={<Package className="size-4" />}>
          <span className="font-extrabold">Pedido {offer.number}</span> · {offer.store_name}
          <span className="block text-[12.5px] text-tinta-suave">
            {Number(offer.item_count)} producto{Number(offer.item_count) === 1 ? "" : "s"}
          </span>
        </Detail>
        <Detail icon={<MapPin className="size-4" />}>
          Recoger en <span className="font-bold">{offer.store_address ?? "la tienda"}</span>
          {offer.destination_department ? <span className="block text-[12.5px] text-tinta-suave">Entrega en {departmentName(offer.destination_department)}</span> : null}
        </Detail>
        {offer.distance_km != null ? <Detail icon={<Route className="size-4" />}>{Number(offer.distance_km).toFixed(1)} km hasta el cliente</Detail> : null}
      </ul>

      {expired ? <Alert tone="warning">La propuesta venció. Si sigues disponible, coordinación puede enviarte otra.</Alert> : null}
      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button
          type="button"
          disabled={busy || expired}
          onClick={() => setRejecting(true)}
          className="min-h-14 rounded-full bg-crema text-[15px] font-bold text-tinta ring-1 ring-borde transition-[background-color,transform] duration-500 ease-fluido hover:bg-rosa hover:text-rojo active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          Rechazar
        </button>
        <button
          type="button"
          disabled={busy || expired}
          onClick={onAccept}
          className="group inline-flex min-h-14 items-center justify-between gap-2 rounded-full bg-selva py-1.5 pl-6 pr-1.5 text-[15px] font-bold text-sobre-acento shadow-pulsa transition-[background-color,transform] duration-500 ease-fluido hover:bg-tinta active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          {busy ? "Un momento…" : "Aceptar"}
          <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-esmeralda text-panel transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
            <Check className="size-5" />
          </span>
        </button>
      </div>

      <Dialog open={rejecting} onClose={() => setRejecting(false)} title="¿Por qué la rechazas?">
        <div className="flex flex-col gap-3">
          <div role="radiogroup" aria-label="Motivo" className="flex flex-col gap-2">
            {rejectReasons.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={choice === item}
                onClick={() => setChoice(item)}
                className={cn("min-h-12 rounded-campo border px-4 text-left text-sm font-bold transition-[background-color,transform] duration-500 ease-fluido active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja", choice === item ? "border-hoja bg-menta text-hoja" : "border-borde-campo bg-white text-tinta")}
              >
                {item}
              </button>
            ))}
          </div>
          {choice === "Otro motivo" ? (
            <Field label="Cuéntanos (opcional)" value={other} onChange={(e) => setOther(e.target.value)} maxLength={200} />
          ) : null}
          {!reasonValid ? <p role="alert" className="text-xs font-bold text-rojo">Escribe al menos 5 caracteres o déjalo vacío.</p> : null}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" className="min-h-12" onClick={() => setRejecting(false)}>
              Volver
            </Button>
            <Button
              variant="danger"
              className="min-h-12"
              disabled={busy || !reasonValid}
              onClick={() => {
                setRejecting(false);
                onReject(reason || null);
              }}
            >
              Rechazar
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
