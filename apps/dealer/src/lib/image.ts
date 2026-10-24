/** Lado más largo permitido de una foto de evidencia. Suficiente para leer un número de pedido y reconocer el lugar. */
export const MAX_SIDE = 1600;
/** El almacenamiento acepta hasta 1 MB por foto: se apunta más bajo para dejar margen. */
export const TARGET_BYTES = 450_000;

/** Tamaño al reducir una imagen para que su lado más largo no pase de `max` (nunca la agranda). */
export function scaledSize(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const ratio = max / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type Compressed = { blob: Blob; width: number; height: number; sha256: string };

/**
 * Reduce la foto en el teléfono (JPEG, lado más largo 1600 px) y baja la calidad hasta que pese poco. Así sube rápido con datos
 * móviles y cabe en el límite del almacenamiento. Lanza si el archivo no es una imagen que el navegador pueda abrir.
 */
export async function compressImage(file: Blob): Promise<Compressed> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no se pudo preparar la foto");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4]) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error("no se pudo preparar la foto");
  return { blob, width, height, sha256: await sha256Hex(blob) };
}
