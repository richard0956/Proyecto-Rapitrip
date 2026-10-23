/**
 * Historial de un pedido para coordinación y administración: mezcla en una sola línea de tiempo los cambios de estado, las
 * propuestas al repartidor, las evidencias de la entrega y los avisos del repartidor.
 */
export type TraceEntry = {
  at: string;
  kind: "estado" | "oferta" | "evidencia" | "aviso";
  title: string;
  detail?: string;
  /** Algo que revisar: ubicación lejos del punto, sin ubicación, propuesta rechazada o vencida, aviso abierto. */
  alert?: boolean;
};

export type TraceEvent = { to_status: string | null; reason: string | null; created_at: string | null };
export type TraceOffer = { courier_id: string | null; status: string | null; offered_at: string | null; expires_at: string | null; responded_at: string | null; reject_reason: string | null };
export type TraceEvidenceRow = { kind: string | null; taken_at: string | null; flagged: boolean | null; flag_reason: string | null; distance_m: number | null; units_count: number | null; note: string | null; purged_at: string | null };
export type TraceIssue = { kind: string | null; reason: string | null; status: string | null; created_at: string | null; attended_at: string | null; attended_note: string | null };

export const evidenceLabel: Record<string, string> = {
  recogida: "Foto de recogida en la tienda",
  entrega: "Foto de entrega al cliente",
  fallida: "Foto de un intento de entrega fallido",
  devolucion_tienda: "Foto de devolución a la tienda",
};

export const issueLabel: Record<string, string> = {
  no_entregado: "No se pudo entregar",
  no_cabe: "No cabe en el vehículo",
  problema: "Problema avisado por el repartidor",
  devuelto: "El repartidor devolvió el pedido",
};

export const flagLabel: Record<string, string> = {
  sin_ubicacion: "Sin ubicación al tomar la foto",
  lejos_del_punto: "Tomada lejos del punto marcado",
};

const offerOutcome: Record<string, string> = {
  aceptada: "aceptó la propuesta",
  rechazada: "rechazó la propuesta",
  vencida: "no respondió: la propuesta venció",
};

export function buildTrace(input: {
  events: TraceEvent[];
  offers: TraceOffer[];
  evidence: TraceEvidenceRow[];
  issues: TraceIssue[];
  courierName: (id: string | null) => string;
  statusLabel: (status: string) => string;
}): TraceEntry[] {
  const out: TraceEntry[] = [];
  for (const event of input.events) {
    if (!event.created_at || !event.to_status) continue;
    out.push({ at: event.created_at, kind: "estado", title: input.statusLabel(event.to_status), detail: event.reason ?? undefined });
  }
  for (const offer of input.offers) {
    const name = input.courierName(offer.courier_id);
    if (offer.offered_at) out.push({ at: offer.offered_at, kind: "oferta", title: `Propuesta a ${name}` });
    const status = offer.status ?? "";
    if (status === "pendiente") continue;
    const at = status === "vencida" ? offer.expires_at : offer.responded_at;
    if (!at) continue;
    const title = status === "cancelada" ? "La propuesta se retiró" : `${name} ${offerOutcome[status] ?? status}`;
    out.push({ at, kind: "oferta", title, detail: offer.reject_reason ?? undefined, alert: status === "rechazada" || status === "vencida" });
  }
  for (const item of input.evidence) {
    if (!item.taken_at) continue;
    const parts: string[] = [];
    if (item.flag_reason) parts.push(flagLabel[item.flag_reason] ?? item.flag_reason);
    if (item.distance_m != null) parts.push(`a ${item.distance_m} m del punto`);
    if (item.units_count != null) parts.push(`${item.units_count} bulto${item.units_count === 1 ? "" : "s"}`);
    if (item.note) parts.push(`«${item.note}»`);
    if (item.purged_at) parts.push("foto eliminada por antigüedad");
    out.push({ at: item.taken_at, kind: "evidencia", title: evidenceLabel[item.kind ?? ""] ?? "Evidencia", detail: parts.join(" · ") || undefined, alert: item.flagged === true });
  }
  for (const issue of input.issues) {
    const label = issueLabel[issue.kind ?? ""] ?? "Aviso del repartidor";
    if (issue.created_at) out.push({ at: issue.created_at, kind: "aviso", title: label, detail: issue.reason ?? undefined, alert: issue.status === "abierta" });
    if (issue.attended_at) out.push({ at: issue.attended_at, kind: "aviso", title: "Aviso atendido", detail: issue.attended_note ?? undefined });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export type CashSummary = { method: string | null; total: number; collected: number | null; code: string | null; receivedAt: string | null };

/** Diferencia entre lo cobrado y el total (negativa: cobró de menos). Nulo si no se cobró en efectivo. */
export function cashDifference(cash: CashSummary): number | null {
  if (cash.method !== "efectivo" || cash.collected === null) return null;
  // `+ 0` evita el cero negativo que deja el redondeo de una resta casi exacta.
  return Math.round((cash.collected - cash.total) * 100) / 100 + 0;
}
