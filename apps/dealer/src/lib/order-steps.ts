/** Qué le toca hacer al repartidor en cada estado del pedido. */
export type StepKey = "esperar" | "recoger" | "entregar" | "entregado" | "cerrado";

export type Step = { key: StepKey; title: string; hint: string };

const steps: Record<string, Step> = {
  confirmado: { key: "esperar", title: "Esperando al comercio", hint: "Todavía no lo preparan. Te avisamos cuando esté listo para recoger." },
  preparando: { key: "esperar", title: "Lo están preparando", hint: "Puedes ir yendo a la tienda. Cuando esté listo podrás recogerlo." },
  listo: { key: "recoger", title: "Listo para recoger", hint: "Pide el código de recogida al comercio y toma la foto del paquete." },
  en_camino: { key: "entregar", title: "En camino", hint: "Pide el código de entrega al cliente y toma la foto al entregar." },
  entregado: { key: "entregado", title: "Entregado", hint: "Listo. Tu entrega quedó registrada." },
};

export function stepFor(status: string | null | undefined): Step {
  return steps[status ?? ""] ?? { key: "cerrado", title: "Pedido cerrado", hint: "Este pedido ya no está activo." };
}

export const statusLabel: Record<string, string> = {
  confirmado: "Confirmado",
  preparando: "Preparando",
  listo: "Listo",
  en_camino: "En camino",
  entregado: "Entregado",
};

/** Un pedido abierto sigue pidiendo acciones del repartidor. */
export function isOpen(status: string | null | undefined): boolean {
  return status === "confirmado" || status === "preparando" || status === "listo" || status === "en_camino";
}

/** `no_cabe` solo se avisa antes de recoger y solo en pedidos express (los programados no se reclasifican). */
export function canReportNoFit(status: string | null | undefined, deliveryClass: string | null | undefined): boolean {
  return (status === "confirmado" || status === "preparando" || status === "listo") && deliveryClass === "express";
}

/** Devolver el pedido solo antes de recogerlo. */
export function canRelease(status: string | null | undefined): boolean {
  return status === "confirmado" || status === "preparando" || status === "listo";
}
