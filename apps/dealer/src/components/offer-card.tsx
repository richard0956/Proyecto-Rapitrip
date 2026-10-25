"use client";

import { Alert, Button, Card, cn, Dialog, Eyebrow, Field } from "@rapitrip/ui";
import { MapPin, Package, Route } from "lucide-react";
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
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-hoja">
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
    <Card outerClassName="bg-menta/60 ring-2 ring-hoja" className="flex flex-col gap-4 p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eyebrow className="shrink-0 whitespace-nowrap">Nueva propuesta</Eyebrow>
          <ClassBadge value={offer.delivery_class} />
        </div>
        <p className={cn("shrink-0 rounded-full px-3 py-1 font-mono text-base font-extrabold tabular-nums transition-colors duration-500 ease-fluido", urgent ? "bg-rosa text-rojo" : "bg-menta text-hoja")} aria-label={expired ? "La propuesta venció" : `Quedan ${formatCountdown(left)}`}>
          {expired ? "Venció" : formatCountdown(left)}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold text-tinta-suave">Te pagan</p>
        <p className="font-titulo text-[34px] font-extrabold leading-none tracking-tight tabular-nums text-tinta">{formatMoney(offer.courier_pay)}</p>
        {offer.cash_total != null ? <p className="text-[12.5px] font-bold text-durazno-texto">Cobras {formatMoney(offer.cash_total)} en efectivo</p> : null}
      </div>

      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-menta-borde/60">
        <div className={cn("h-full origin-left rounded-full transition-transform duration-1000 ease-fluido", urgent ? "bg-rojo" : "bg-hoja")} style={{ transform: `scaleX(${expired ? 0 : remaining})` }} />
      </div>

      <ul className="flex flex-col gap-3 text-[14px]">
        <Detail icon={<Package className="size-4" />}>
          <span className="font-extrabold text-tinta">Pedido {offer.number}</span> · {offer.store_name}
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
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Button variant="secondary" className="min-h-14 text-base" disabled={busy || expired} onClick={() => setRejecting(true)}>
          Rechazar
        </Button>
        <Button variant="primary" className="min-h-14 text-base" disabled={busy || expired} onClick={onAccept}>
          {busy ? "Un momento…" : "Aceptar"}
        </Button>
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
    </Card>
  );
}
