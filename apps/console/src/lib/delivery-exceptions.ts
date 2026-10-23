import { flagLabel, issueLabel } from "./order-trace";

/** Una entrega más rápida que esto (de la foto de recogida a la foto de entrega) merece una segunda mirada. */
export const FAST_DELIVERY_MINUTES = 3;
/** Propuestas vencidas de un mismo repartidor, en 24 horas, a partir de las cuales se avisa. */
export const IGNORED_OFFERS_LIMIT = 3;

export type DeliveryException = { number: number; detail: string; at: string };
export type IgnoredOffers = { courier: string; count: number };
export type DeliveryExceptions = {
  avisos: DeliveryException[];
  incompletas: DeliveryException[];
  marcadas: DeliveryException[];
  rapidas: DeliveryException[];
  sinRespuesta: IgnoredOffers[];
};

type Issue = { number: number; kind: string; reason: string; at: string };
type Status = { number: number; status: string; complete: boolean; at: string };
type Evidence = { number: number; kind: string; at: string; flagged: boolean; flagReason: string | null; distanceM: number | null };
type Offer = { courierName: string; status: string };

/**
 * Qué mirar de la operación de los repartidores: avisos abiertos, pedidos en camino o entregados sin la evidencia exigida,
 * fotos marcadas (ubicación lejos o ausente), entregas sospechosamente rápidas y repartidores que dejan vencer propuestas.
 */
export function classifyDeliveryExceptions(input: { issues: Issue[]; statuses: Status[]; evidence: Evidence[]; offers: Offer[] }): DeliveryExceptions {
  const byTimeDesc = (a: DeliveryException, b: DeliveryException) => b.at.localeCompare(a.at);

  const avisos = input.issues.map((issue) => ({ number: issue.number, detail: `${issueLabel[issue.kind] ?? "Aviso"}: «${issue.reason}»`, at: issue.at })).sort(byTimeDesc);

  const incompletas = input.statuses
    .filter((row) => !row.complete && (row.status === "en_camino" || row.status === "entregado"))
    .map((row) => ({ number: row.number, detail: row.status === "entregado" ? "Entregado sin la evidencia exigida" : "En camino sin la evidencia de recogida", at: row.at }))
    .sort(byTimeDesc);

  const marcadas = input.evidence
    .filter((row) => row.flagged)
    .map((row) => ({
      number: row.number,
      detail: `${row.kind === "entrega" ? "Entrega" : row.kind === "recogida" ? "Recogida" : "Intento"}: ${flagLabel[row.flagReason ?? ""] ?? "marcada"}${row.distanceM != null ? ` (a ${row.distanceM} m)` : ""}`,
      at: row.at,
    }))
    .sort(byTimeDesc);

  // Entregas rápidas: entre la foto de recogida y la de entrega pasaron muy pocos minutos.
  const pickups = new Map<number, string>();
  for (const row of input.evidence) if (row.kind === "recogida") pickups.set(row.number, row.at);
  const rapidas: DeliveryException[] = [];
  for (const row of input.evidence) {
    if (row.kind !== "entrega") continue;
    const pickup = pickups.get(row.number);
    if (!pickup) continue;
    const minutes = (new Date(row.at).getTime() - new Date(pickup).getTime()) / 60_000;
    if (minutes >= 0 && minutes < FAST_DELIVERY_MINUTES) rapidas.push({ number: row.number, detail: `Entregado ${minutes < 1 ? "en menos de 1 minuto" : `${Math.round(minutes)} min`} después de recoger`, at: row.at });
  }
  rapidas.sort(byTimeDesc);

  const ignored = new Map<string, number>();
  for (const offer of input.offers) if (offer.status === "vencida") ignored.set(offer.courierName, (ignored.get(offer.courierName) ?? 0) + 1);
  const sinRespuesta = [...ignored.entries()]
    .filter(([, count]) => count >= IGNORED_OFFERS_LIMIT)
    .map(([courier, count]) => ({ courier, count }))
    .sort((a, b) => b.count - a.count || a.courier.localeCompare(b.courier, "es"));

  return { avisos, incompletas, marcadas, rapidas, sinRespuesta };
}

/** Ventanas de tiempo de las excepciones: últimas 24 horas (propuestas) y últimos 7 días (fotos y entregas). */
export function exceptionWindows(now: Date = new Date()): { day: string; week: string } {
  return { day: new Date(now.getTime() - 24 * 3_600_000).toISOString(), week: new Date(now.getTime() - 7 * 24 * 3_600_000).toISOString() };
}
