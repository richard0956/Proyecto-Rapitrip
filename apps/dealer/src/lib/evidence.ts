import { friendlyError } from "./api-error";
import type { QueueItem, UploadOutcome } from "./evidence-queue";
import type { Supabase } from "./client";

export const BUCKET = "entregas";

/** `<ficha>/<pedido>/<tipo>-<id>.jpg`: la base de datos exige exactamente esta forma y que la carpeta sea la del repartidor. */
export function evidencePath(courierId: string, item: Pick<QueueItem, "orderId" | "kind" | "id">): string {
  return `${courierId}/${item.orderId}/${item.kind}-${item.id}.jpg`;
}

function alreadyExists(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false;
  return String(error.statusCode) === "409" || /already exists|duplicate/i.test(error.message ?? "");
}

/**
 * Sube la foto y registra la evidencia. Es repetible: si la foto ya estaba subida se sigue con el registro, y la base de datos
 * devuelve la misma evidencia si el envío se repite. Devuelve si el fallo es definitivo (no se arregla reintentando).
 */
export async function uploadEvidence(supabase: Supabase, courierId: string, item: QueueItem): Promise<UploadOutcome> {
  const path = evidencePath(courierId, item);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, item.blob, { contentType: "image/jpeg", upsert: false });
  if (uploadError && !alreadyExists(uploadError)) {
    return { ok: false, error: friendlyError({ message: uploadError.message }, "No se pudo subir la foto.") };
  }
  const { error } = await supabase.rpc("courier_add_evidence", {
    p_order: item.orderId,
    p_kind: item.kind,
    p_path: path,
    p_sha256: item.sha256,
    ...(item.latitude != null && item.longitude != null ? { p_latitude: item.latitude, p_longitude: item.longitude } : {}),
    ...(item.units != null ? { p_units: item.units } : {}),
    ...(item.note ? { p_note: item.note } : {}),
  });
  if (!error) return { ok: true };
  const permanent = error.code === "22023" || error.code === "23505" || error.code === "P0002";
  return { ok: false, error: friendlyError(error), permanent };
}
