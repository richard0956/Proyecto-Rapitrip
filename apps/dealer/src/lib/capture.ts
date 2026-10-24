import { currentPosition } from "./geo";
import { compressImage } from "./image";
import type { QueueItem } from "./evidence-queue";

export type CaptureInput = { orderId: string; kind: QueueItem["kind"]; file: Blob; units?: number | null; note?: string | null };
export type Submit = (item: Omit<QueueItem, "id" | "createdAt" | "attempts" | "lastError">) => Promise<void>;

/**
 * Prepara una foto de evidencia: la reduce, toma la ubicación puntual (si el teléfono la da) y la entrega a la cola, que la
 * guarda en el teléfono y la sube. La ubicación nunca bloquea: sin ella la foto sale igual, marcada para revisión en el servidor.
 */
export async function captureEvidence(submit: Submit, input: CaptureInput): Promise<void> {
  const [compressed, position] = await Promise.all([compressImage(input.file), currentPosition()]);
  await submit({
    orderId: input.orderId,
    kind: input.kind,
    blob: compressed.blob,
    sha256: compressed.sha256,
    latitude: position?.latitude ?? null,
    longitude: position?.longitude ?? null,
    units: input.units ?? null,
    note: input.note ?? null,
  });
}
