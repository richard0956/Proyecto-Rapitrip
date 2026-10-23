import { deliveryClassLabel, deliveryEtaText } from "@rapitrip/validation";
import type { Quote } from "./catalog";

/** Un envío de la compra: lo que sale de una tienda hacia el cliente, express (moto, horas) o programado (vehículo, días). */
export type Shipment = {
  delivery_class: "express" | "programado";
  /** Por qué es programado: un producto grande, más de 20 km o un departamento distinto. Nulo en los express. */
  reason: "producto" | "distancia" | "otro_departamento" | null;
  items: { variant_id: string; quantity: number }[];
  zone: number | null;
  band: number | null;
  customer_fee: number;
  eta_min_days: number | null;
  eta_max_days: number | null;
};

/** Cotización de la entrega de una tienda: puede salir en uno o dos envíos (productos pequeños y grandes). */
export type GroupQuote = {
  origin_department: string | null;
  destination_department: string | null;
  shipments: Shipment[];
};

export const classLabel = (shipment: Pick<Shipment, "delivery_class">) => deliveryClassLabel(shipment.delivery_class);

/** Plazo en palabras claras: horas para express, días para programado. */
export const etaText = (shipment: Pick<Shipment, "delivery_class" | "eta_min_days" | "eta_max_days">) => deliveryEtaText(shipment.delivery_class, shipment.eta_min_days, shipment.eta_max_days);

/** Explica por qué un envío es programado, para que el cliente no lo tome por un error. */
export function reasonText(reason: Shipment["reason"]): string | null {
  switch (reason) {
    case "producto":
      return "Producto grande o con preparación: lo lleva un repartidor con vehículo.";
    case "distancia":
      return "El destino queda a más de 20 km de la tienda: se entrega de forma programada.";
    case "otro_departamento":
      return "La tienda está en otro departamento: se entrega de forma programada.";
    default:
      return null;
  }
}

/** Subtotal de un envío con los precios de la cotización del carrito. */
export function shipmentSubtotal(shipment: Pick<Shipment, "items">, quote: Pick<Quote, "lines"> | null): number {
  if (!quote) return 0;
  const ids = new Set(shipment.items.map((item) => item.variant_id));
  return quote.lines.filter((line) => ids.has(line.variant_id)).reduce((sum, line) => sum + line.line_total, 0);
}

/** Cuántos envíos tiene la compra en total, entre todas las tiendas. */
export function shipmentCount(quotes: Record<string, GroupQuote | undefined>): number {
  return Object.values(quotes).reduce((sum, quote) => sum + (quote?.shipments.length ?? 0), 0);
}

/** Total de los envíos de una compra. */
export function deliveryTotal(quotes: Record<string, GroupQuote | undefined>): number {
  return Object.values(quotes).reduce((sum, quote) => sum + (quote?.shipments.reduce((s, shipment) => s + shipment.customer_fee, 0) ?? 0), 0);
}
