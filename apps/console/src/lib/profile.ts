import { serverSupabase } from "./supabase";

/** Nombre para mostrar en el shell. Si no se puede leer, el shell cae a la inicial genérica. */
export async function displayName(): Promise<string | null> {
  const supabase = await serverSupabase();
  const { data } = await supabase.from("my_profile").select("full_name").maybeSingle();
  return data?.full_name ?? null;
}
