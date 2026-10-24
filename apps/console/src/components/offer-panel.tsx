"use client";

import { Alert, Badge, Button, SelectField } from "@rapitrip/ui";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";
import { formatCountdown, offerLabel, openOffer, type OfferInfo } from "@/lib/offers";
import { useNow } from "@/lib/use-now";

export type OfferableCourier = { id: string; name: string; vehicleClass: string | null; department: string | null; activeOrders: number };

type Props = {
  orderId: string;
  /** El pedido admite proponerse: confirmado, en preparación o listo, y sin repartidor. */
  canOffer: boolean;
  offers: OfferInfo[];
  loadOfferable: (orderId: string) => Promise<{ ok: true; couriers: OfferableCourier[] } | { ok: false; error: string }>;
  offer: (orderId: string, courierId: string) => Promise<ActionResult>;
  cancel: (offerId: string) => Promise<ActionResult>;
};

/**
 * Proponer el pedido a un repartidor disponible. La propuesta vive 3 minutos: si la acepta, el pedido pasa a ser suyo; si la
 * rechaza o no responde, aquí se ve y se propone a otro. Asignar directamente sigue disponible como excepción.
 */
export function OfferPanel({ orderId, canOffer, offers, loadOfferable, offer, cancel }: Props) {
  const router = useRouter();
  const now = useNow();
  const [couriers, setCouriers] = useState<OfferableCourier[] | null>(null);
  const [choice, setChoice] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const open = openOffer(offers, now);
  const last = offers.find((item) => item !== open) ?? null;

  useEffect(() => {
    if (!canOffer || open) return;
    let cancelled = false;
    void loadOfferable(orderId).then((result) => {
      if (cancelled) return;
      if (result.ok) setCouriers(result.couriers);
      else setMessage({ ok: false, text: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, canOffer, open?.id, loadOfferable]); // eslint-disable-line react-hooks/exhaustive-deps

  function send() {
    setMessage(null);
    start(async () => {
      const result = await offer(orderId, choice);
      setMessage(result.ok ? { ok: true, text: "Propuesta enviada. El repartidor tiene 3 minutos para responder." } : { ok: false, text: result.error });
      if (result.ok) {
        setChoice("");
        router.refresh();
      }
    });
  }

  function withdraw(id: string) {
    setMessage(null);
    start(async () => {
      const result = await cancel(id);
      setMessage(result.ok ? { ok: true, text: "Retiraste la propuesta." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  if (!canOffer && !open && !last) return null;
  return (
    <div className="mb-3.5 flex flex-col gap-2.5 rounded-panel border border-borde p-3.5">
      <p className="flex items-center gap-2 text-sm font-bold text-tinta">
        <Send className="size-4" aria-hidden="true" /> Proponer a un repartidor
      </p>
      {open ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-tinta">
            Esperando a <span className="font-bold">{open.courierName}</span> <Badge tone="warning">{formatCountdown(open.secondsLeft)}</Badge>
          </p>
          <Button variant="secondary" className="min-h-9 px-3" disabled={pending} onClick={() => withdraw(open.id)}>
            Retirar propuesta
          </Button>
        </div>
      ) : canOffer ? (
        couriers === null ? (
          <p className="text-xs text-tinta-suave">Buscando repartidores disponibles…</p>
        ) : couriers.length === 0 ? (
          <p className="text-xs text-tinta-suave">Ningún repartidor puede recibir una propuesta ahora: deben estar disponibles, con cuenta, ser compatibles con este pedido y no tener otra propuesta abierta. Puedes asignarlo directamente.</p>
        ) : (
          <>
            <SelectField label="Repartidor disponible" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Elige un repartidor</option>
              {couriers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.activeOrders} pedido{item.activeOrders === 1 ? "" : "s"} en curso
                </option>
              ))}
            </SelectField>
            <Button variant="primary" className="self-start" disabled={pending || !choice} onClick={send}>
              {pending ? "Enviando…" : "Enviar propuesta"}
            </Button>
          </>
        )
      ) : null}
      {last ? (
        <Alert tone={last.status === "rechazada" || last.status === "vencida" ? "warning" : "info"}>
          Última propuesta: {offerLabel(last)}
        </Alert>
      ) : null}
      {message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}
    </div>
  );
}
