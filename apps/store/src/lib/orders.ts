export type OrderStatus = "pendiente_pago" | "por_confirmar" | "confirmado" | "preparando" | "listo" | "en_camino" | "entregado" | "cancelado" | "rechazado";

export const orderStatusLabel: Record<OrderStatus, string> = {
  pendiente_pago: "Esperando pago",
  por_confirmar: "Por confirmar",
  confirmado: "Confirmado",
  preparando: "Preparando",
  listo: "Listo para salir",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
  rechazado: "Rechazado",
};

export const orderStatusHint: Record<OrderStatus, string> = {
  pendiente_pago: "Completa el pago con tarjeta para que el comercio reciba tu pedido.",
  por_confirmar: "El comercio está revisando tu pedido.",
  confirmado: "El comercio aceptó tu pedido.",
  preparando: "Están preparando tu pedido.",
  listo: "Tu pedido está listo y espera repartidor.",
  en_camino: "Tu pedido va en camino.",
  entregado: "Tu pedido llegó.",
  cancelado: "Este pedido se canceló.",
  rechazado: "El comercio no pudo aceptar este pedido.",
};

export const orderStatusTone: Record<OrderStatus, "neutral" | "warning" | "positive" | "danger"> = {
  pendiente_pago: "neutral",
  por_confirmar: "warning",
  confirmado: "positive",
  preparando: "positive",
  listo: "positive",
  en_camino: "positive",
  entregado: "positive",
  cancelado: "danger",
  rechazado: "danger",
};

export const isOrderStatus = (value: string | null | undefined): value is OrderStatus => !!value && value in orderStatusLabel;

export const isFinalStatus = (status: OrderStatus) => status === "entregado" || status === "cancelado" || status === "rechazado";

/** El cliente puede cancelar mientras el pedido no lo haya aceptado el comercio (la base de datos vuelve a comprobarlo). */
export const customerCanCancel = (status: OrderStatus) => status === "pendiente_pago" || status === "por_confirmar";

/** Pasos del recorrido feliz para la línea de avance. */
export const progressSteps: OrderStatus[] = ["por_confirmar", "confirmado", "preparando", "listo", "en_camino", "entregado"];

/** Posición del estado en el recorrido (0 a 5). Un pedido sin pagar todavía no empezó; los finales negativos no avanzan. */
export function progressIndex(status: OrderStatus): number {
  if (status === "pendiente_pago") return -1;
  const index = progressSteps.indexOf(status);
  return index;
}

/** Tiempo restante hasta una fecha, en texto corto («12 min», «45 s»). Nulo si ya pasó. */
export function remainingText(until: string | null | undefined, now = Date.now()): string | null {
  if (!until) return null;
  const seconds = Math.floor((new Date(until).getTime() - now) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `${seconds} s`;
  return `${Math.ceil(seconds / 60)} min`;
}

/** ¿El regreso de Stripe todavía no se refleja? Con `?pago=ok` y el pedido aún sin pagar, el webhook no llegó. */
export function awaitingPaymentConfirmation(pago: string | undefined, status: OrderStatus): boolean {
  return pago === "ok" && status === "pendiente_pago";
}
