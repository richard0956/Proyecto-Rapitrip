import type { SupabaseClient } from "@supabase/supabase-js";

/** Foto de perfil: hasta 2 MB, en JPG, PNG o WebP. El bucket «avatars» es privado y cada cliente usa su carpeta <id>/. */
export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Devuelve el problema con el archivo elegido, o null si sirve. */
export function avatarProblem(file: { name: string; size: number; type: string }): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return "Elige una imagen JPG, PNG o WebP.";
  if (file.size > MAX_AVATAR_BYTES) return "La foto pesa más de 2 MB. Elige una más liviana.";
  return null;
}

/** Ruta en el bucket: <id del cliente>/<marca de tiempo>.<extensión>. Cada foto nueva tiene nombre propio (sin caché vieja). */
export function avatarPath(userId: string, fileName: string, now: number = Date.now()): string {
  const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${userId}/${now}.${ext}`;
}

/** Enlace firmado (1 hora) para mostrar la foto; null si no hay foto o no se pudo firmar. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function avatarUrl(supabase: SupabaseClient<any, any, any>, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
