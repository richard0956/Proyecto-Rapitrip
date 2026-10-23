/** Una propuesta de pedido a un repartidor, tal como la ve coordinación. */
export type OfferInfo = {
  id: string;
  courierName: string;
  status: "pendiente" | "aceptada" | "rechazada" | "vencida" | "cancelada";
  expiresAt: string;
  respondedAt: string | null;
  rejectReason: string | null;
};

export type OpenOffer = OfferInfo & { secondsLeft: number };

export function secondsLeft(expiresAt: string, now: number): number {
  const end = new Date(expiresAt).getTime();
  return Number.isNaN(end) ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

/** La propuesta que sigue esperando respuesta (pendiente y con tiempo); las vencidas sin marcar no cuentan. */
export function openOffer(offers: OfferInfo[], now: number): OpenOffer | null {
  for (const offer of offers) {
    if (offer.status !== "pendiente") continue;
    const left = secondsLeft(offer.expiresAt, now);
    if (left > 0) return { ...offer, secondsLeft: left };
  }
  return null;
}

/** Cómo terminó una propuesta, en una frase. */
export function offerLabel(offer: OfferInfo): string {
  switch (offer.status) {
    case "aceptada":
      return `${offer.courierName} la aceptó.`;
    case "rechazada":
      return `${offer.courierName} la rechazó${offer.rejectReason ? `: «${offer.rejectReason}»` : ""}. Propónsela a otro.`;
    case "vencida":
      return `${offer.courierName} no respondió a tiempo. Propónsela a otro.`;
    case "cancelada":
      return `Se retiró la propuesta a ${offer.courierName}.`;
    default:
      return `Esperando a ${offer.courierName}.`;
  }
}
