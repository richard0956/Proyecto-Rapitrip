import { avatarUrl } from "./avatar";
import { serverSupabase } from "./supabase";

/** Nombre para mostrar en el shell. Si no se puede leer, el shell cae a la inicial genérica. */
export async function displayName(): Promise<string | null> {
  const supabase = await serverSupabase();
  const { data } = await supabase.from("my_profile").select("full_name").maybeSingle();
  return data?.full_name ?? null;
}

/** Enlace firmado de la foto de perfil de quien está en sesión, para el shell; null si no tiene foto. */
export async function myPhotoUrl(): Promise<string | null> {
  const supabase = await serverSupabase();
  const { data } = await supabase.from("my_profile").select("avatar_path").maybeSingle();
  return avatarUrl(supabase, data?.avatar_path);
}
