export type OrderStatus = "pendiente_pago" | "por_confirmar" | "confirmado" | "preparando" | "listo" | "en_camino" | "entregado" | "cancelado" | "rechazado";
export type OrderGroup = "confirmar" | "curso" | "terminados";

export const orderStatuses: OrderStatus[] = ["pendiente_pago", "por_confirmar", "confirmado", "preparando", "listo", "en_camino", "entregado", "cancelado", "rechazado"];

export const orderStatusLabel: Record<OrderStatus, string> = {
  pendiente_pago: "Esperando pago",
  por_confirmar: "Por confirmar",
  confirmado: "Confirmado",
  preparando: "Preparando",
  listo: "Listo",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
  rechazado: "Rechazado",
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

export function orderGroup(status: OrderStatus): OrderGroup {
  if (status === "por_confirmar") return "confirmar";
  if (status === "entregado" || status === "cancelado" || status === "rechazado") return "terminados";
  return "curso";
}

export type ShopAction = { to: OrderStatus; label: string; reason?: boolean };

/** Lo que el comercio puede hacer con un pedido (la base de datos vuelve a comprobarlo). Después de «listo», sigue coordinación. */
export function shopActions(status: OrderStatus): ShopAction[] {
  switch (status) {
    case "por_confirmar":
      return [{ to: "confirmado", label: "Confirmar" }, { to: "rechazado", label: "Rechazar", reason: true }];
    case "confirmado":
      return [{ to: "preparando", label: "Empezar a preparar" }, { to: "cancelado", label: "Cancelar", reason: true }];
    case "preparando":
      return [{ to: "listo", label: "Marcar como listo" }, { to: "cancelado", label: "Cancelar", reason: true }];
    default:
      return [];
  }
}

export function paymentLabel(method: string | null, status: string | null): string {
  if (method === "efectivo") return status === "pagado" ? "Efectivo · cobrado" : "Efectivo contra entrega";
  if (status === "pagado") return "Tarjeta · pagada";
  if (status === "reembolso_pendiente") return "Tarjeta · reembolso en proceso";
  if (status === "reembolsado") return "Tarjeta · reembolsada";
  return "Tarjeta · sin pagar";
}

/** Inicio del día de hoy en Nicaragua (UTC−6, sin horario de verano), como instante ISO, para las métricas del día. */
export function startOfTodayIso(now = new Date()): string {
  const shifted = new Date(now.getTime() - 6 * 3_600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 6)).toISOString();
}

/** Estados que cuentan como venta del día: el comercio ya confirmó el pedido. */
export const salesStatuses: OrderStatus[] = ["confirmado", "preparando", "listo", "en_camino", "entregado"];

export type CoordTab = "listos" | "camino" | "preparacion" | "espera" | "terminados";

/** Pestañas de coordinación: lo que hay que despachar, lo que va en camino y lo que todavía depende de otros. */
export function coordTab(status: OrderStatus): CoordTab {
  if (status === "listo") return "listos";
  if (status === "en_camino") return "camino";
  if (status === "confirmado" || status === "preparando") return "preparacion";
  if (status === "por_confirmar" || status === "pendiente_pago") return "espera";
  return "terminados";
}

export type CoordAction = { to: OrderStatus; label: string; reason?: boolean; needsCourier?: boolean };

/** Lo que coordinación puede hacer con un pedido (la base de datos vuelve a comprobarlo): despachar, entregar o cancelar con motivo. */
export function coordActions(status: OrderStatus): CoordAction[] {
  switch (status) {
    case "listo":
      return [{ to: "en_camino", label: "Despachar", needsCourier: true }, { to: "cancelado", label: "Cancelar pedido", reason: true }];
    case "en_camino":
      return [{ to: "entregado", label: "Marcar como entregado" }, { to: "cancelado", label: "Cancelar pedido", reason: true }];
    case "confirmado":
    case "preparando":
    case "por_confirmar":
    case "pendiente_pago":
      return [{ to: "cancelado", label: "Cancelar pedido", reason: true }];
    default:
      return [];
  }
}

/** Umbrales de las excepciones (minutos sin movimiento). El comercio tiene 45 para responder; se avisa a la mitad. */
export const EXCEPTION_MINUTES = { sinRespuesta: 20, enCamino: 60 } as const;

export type ExceptionKind = "sin_repartidor" | "sin_respuesta" | "en_camino_largo" | "reembolso_pendiente";
export type ExceptionOrder = { number: number; status: OrderStatus; paymentStatus: string | null; courierId: string | null; updatedAt: string; channel: string | null };

/** Clasifica los pedidos de la tienda web que necesitan atención de la administración. Un pedido puede caer en más de una. */
export function classifyExceptions(orders: ExceptionOrder[], now = Date.now()): Record<ExceptionKind, ExceptionOrder[]> {
  const minutes = (order: ExceptionOrder) => (now - new Date(order.updatedAt).getTime()) / 60_000;
  const web = orders.filter((order) => order.channel === "web");
  return {
    sin_repartidor: web.filter((o) => o.status === "listo" && o.courierId === null),
    sin_respuesta: web.filter((o) => o.status === "por_confirmar" && minutes(o) >= EXCEPTION_MINUTES.sinRespuesta),
    en_camino_largo: web.filter((o) => o.status === "en_camino" && minutes(o) >= EXCEPTION_MINUTES.enCamino),
    reembolso_pendiente: web.filter((o) => o.paymentStatus === "reembolso_pendiente"),
  };
}
