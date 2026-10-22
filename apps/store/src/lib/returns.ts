/** Fotos de una devolución: de 1 a 5, en JPG, PNG o WebP, de hasta 8 MB cada una. */
export const MAX_RETURN_PHOTOS = 5;
export const MAX_RETURN_PHOTO_BYTES = 8 * 1024 * 1024;
export const RETURN_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const RETURN_WINDOW_DAYS = 3;

export type PhotoFile = { name: string; size: number; type: string };

/** Devuelve el primer problema con las fotos elegidas, o null si son válidas. */
export function photoProblem(files: PhotoFile[]): string | null {
  if (files.length === 0) return "Adjunta al menos una foto del producto.";
  if (files.length > MAX_RETURN_PHOTOS) return `Puedes adjuntar hasta ${MAX_RETURN_PHOTOS} fotos.`;
  for (const file of files) {
    if (!(RETURN_PHOTO_TYPES as readonly string[]).includes(file.type)) return `«${file.name}» no es una imagen JPG, PNG o WebP.`;
    if (file.size > MAX_RETURN_PHOTO_BYTES) return `«${file.name}» pesa más de 8 MB.`;
  }
  return null;
}

/** Una devolución se pide dentro de los 3 días posteriores a la entrega. */
export function withinReturnWindow(deliveredAt: string | null, now: Date = new Date()): boolean {
  if (!deliveredAt) return false;
  const delivered = new Date(deliveredAt).getTime();
  return now.getTime() - delivered <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Ruta en el bucket: <id_cliente>/<id_pedido>/<marca>-<posición>.<extensión>. La base de datos exige que empiece por el id del cliente. */
export function photoPath(customerId: string, orderId: string, index: number, fileName: string, now: number = Date.now()): string {
  const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${customerId}/${orderId}/${now}-${index}.${ext}`;
}

export type ReturnStatus = "solicitada" | "aprobada" | "rechazada";

/** Lo que ve el cliente según el estado de su devolución y cómo pagó. */
export function returnStatusText(status: ReturnStatus, paymentMethod: "tarjeta" | "efectivo"): { title: string; detail: string } {
  if (status === "solicitada") return { title: "Solicitud en revisión", detail: "Administración revisará tus fotos y te dirá la decisión aquí mismo." };
  if (status === "rechazada") return { title: "Devolución no aprobada", detail: "Administración revisó tu solicitud y no la aprobó. La nota explica el motivo." };
  return paymentMethod === "tarjeta"
    ? { title: "Devolución aprobada", detail: "Procesaremos el reembolso a tu tarjeta." }
    : { title: "Devolución aprobada", detail: "Pasa a la caja para que te devuelvan el efectivo." };
}
