/** Clase de entrega de un pedido: express (moto, horas) o programado (vehículo, días). Lo comparten la tienda y la consola. */
export type DeliveryClass = "express" | "programado";

export const toDeliveryClass = (value: string | null | undefined): DeliveryClass => (value === "programado" ? "programado" : "express");

export const deliveryClassLabel = (value: DeliveryClass) => (value === "programado" ? "Programado" : "Express");

/** Plazo en palabras claras: horas para express, días para programado. */
export function deliveryEtaText(deliveryClass: DeliveryClass, min: number | null | undefined, max: number | null | undefined): string {
  if (deliveryClass === "express") return "Llega en pocas horas";
  if (min === null || min === undefined || max === null || max === undefined) return "Se entrega en días";
  if (min === max) return max === 1 ? "Llega en 1 día" : `Llega en ${max} días`;
  return `Llega en ${min} a ${max} días`;
}
