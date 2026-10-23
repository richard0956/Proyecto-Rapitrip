import { deliveryClassLabel, deliveryEtaText, toDeliveryClass, type DeliveryClass } from "@rapitrip/validation";

/** Clase de entrega y plazo: la misma redacción que la tienda (viene de `@rapitrip/validation`). */
export type { DeliveryClass };
export { toDeliveryClass };
export const classLabel = deliveryClassLabel;
export const etaText = deliveryEtaText;
