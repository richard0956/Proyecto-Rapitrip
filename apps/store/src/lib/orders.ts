export type OrderStatus = "pendiente_pago" | "por_confirmar" | "en_validacion" | "confirmado" | "preparando" | "listo" | "en_camino" | "entregado" | "cancelado" | "rechazado";

export const orderStatusLabel: Record<OrderStatus, string> = {
  pendiente_pago: "Esperando pago",
  por_confirmar: "Por confirmar",
  en_validacion: "En validación",
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
  en_validacion: "El comercio está validando tu pedido (disponibilidad y preparación). Te avisamos cuando lo confirme.",
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
  en_validacion: "warning",
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
export const customerCanCancel = (status: OrderStatus) => status === "pendiente_pago" || status === "por_confirmar" || status === "en_validacion";

/** Pasos del recorrido feliz para la línea de avance. */
export const progressSteps: OrderStatus[] = ["por_confirmar", "confirmado", "preparando", "listo", "en_camino", "entregado"];

/** Posición del estado en el recorrido (0 a 5). Un pedido sin pagar todavía no empezó; los finales negativos no avanzan. */
export function progressIndex(status: OrderStatus): number {
  if (status === "pendiente_pago") return -1;
  // Validar es parte de esperar al comercio: se muestra en el mismo paso que «Por confirmar».
  if (status === "en_validacion") return 0;
  const index = progressSteps.indexOf(status);
  return index;
}

/** Tiempo restante hasta una fecha, en texto corto («12 min», «45 s»). Nulo si ya pasó. */
export function remainingText(until: string | null | undefined, now = Date.now()): string | null {
  if (!until) return null;
  const seconds = Math.floor((new Date(until).getTime() - now) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 120) return `${minutes} min`;
  // Los pedidos programados tienen plazos de horas o días: «1440 min» no se entiende.
  const hours = Math.ceil(minutes / 60);
  if (hours <= 48) return `${hours} h`;
  return `${Math.ceil(hours / 24)} días`;
}

/** ¿El regreso de Stripe todavía no se refleja? Con `?pago=ok` y el pedido aún sin pagar, el webhook no llegó. */
export function awaitingPaymentConfirmation(pago: string | undefined, status: OrderStatus): boolean {
  return pago === "ok" && status === "pendiente_pago";
}
