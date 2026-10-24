"use client";

import { Alert, Button, Card, cn, Dialog } from "@rapitrip/ui";
import { Banknote, MapPin, Package, Route } from "lucide-react";
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

/** La propuesta abierta: de dónde sale, cuánto paga, si cobra, y una cuenta regresiva. Dos botones grandes: aceptar o rechazar. */
export function OfferCard({ offer, busy, onAccept, onReject }: Props) {
  const left = useCountdown(offer.expires_at);
  const [rejecting, setRejecting] = useState(false);
  const [choice, setChoice] = useState<string>(rejectReasons[0]);
  const [other, setOther] = useState("");
  const expired = left <= 0;
  const urgent = left > 0 && left <= 30;
  const reason = choice === "Otro motivo" ? other.trim() : choice;
  const reasonValid = reason.length === 0 || (reason.length >= 5 && reason.length <= 200);

  return (
    <Card className="flex flex-col gap-4 border-2 border-hoja p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-hoja">Nueva propuesta</p>
          <ClassBadge value={offer.delivery_class} />
        </div>
        <p className={cn("rounded-full px-3 py-1 font-mono text-base font-extrabold tabular-nums", urgent ? "bg-rosa text-rojo" : "bg-menta text-hoja")} aria-label={expired ? "La propuesta venció" : `Quedan ${formatCountdown(left)}`}>
          {expired ? "Venció" : formatCountdown(left)}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 text-[14px]">
        <p className="flex items-start gap-2.5">
          <Package className="mt-0.5 size-[18px] shrink-0 text-hoja" aria-hidden="true" />
          <span>
            <span className="font-extrabold text-tinta">Pedido {offer.number}</span> · {offer.store_name}
            <span className="block text-[12.5px] text-tinta-suave">{Number(offer.item_count)} producto{Number(offer.item_count) === 1 ? "" : "s"}</span>
          </span>
        </p>
        <p className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 size-[18px] shrink-0 text-hoja" aria-hidden="true" />
          <span>
            Recoger en <span className="font-bold">{offer.store_address ?? "la tienda"}</span>
            {offer.destination_department ? <span className="block text-[12.5px] text-tinta-suave">Entrega en {departmentName(offer.destination_department)}</span> : null}
          </span>
        </p>
        {offer.distance_km != null ? (
          <p className="flex items-center gap-2.5">
            <Route className="size-[18px] shrink-0 text-hoja" aria-hidden="true" />
            <span>{Number(offer.distance_km).toFixed(1)} km hasta el cliente</span>
          </p>
        ) : null}
        <p className="flex items-center gap-2.5">
          <Banknote className="size-[18px] shrink-0 text-hoja" aria-hidden="true" />
          <span>
            Te pagan <span className="font-extrabold text-tinta">{formatMoney(offer.courier_pay)}</span>
            {offer.cash_total != null ? <span className="block text-[12.5px] font-bold text-durazno-texto">Cobras {formatMoney(offer.cash_total)} en efectivo</span> : null}
          </span>
        </p>
      </div>

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
                className={cn("min-h-12 rounded-campo border px-4 text-left text-sm font-bold", choice === item ? "border-hoja bg-menta text-hoja" : "border-borde-campo bg-white text-tinta")}
              >
                {item}
              </button>
            ))}
          </div>
          {choice === "Otro motivo" ? (
            <label className="flex flex-col gap-1.5 text-xs font-bold text-tinta-suave">
              Cuéntanos (opcional)
              <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={200} className="min-h-12 rounded-campo border border-borde-campo bg-white px-3.5 text-sm font-normal text-tinta" />
            </label>
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
