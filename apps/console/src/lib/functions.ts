import { serverSupabase } from "./supabase";

export type FunctionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const generic = "No se pudo completar la acción. Inténtalo de nuevo.";

/** Invoca una Edge Function con el token de quien actúa. Solo reenvía mensajes de errores esperados (400, 403, 404, 409). */
export async function invokeFunction<T>(name: string, body: unknown): Promise<FunctionResult<T>> {
  const supabase = await serverSupabase();
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (!error) return { ok: true, data: data as T };
  const response = (error as { context?: Response }).context;
  if (response && [400, 403, 404, 409].includes(response.status)) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof payload?.error === "string") return { ok: false, error: payload.error };
  }
  console.error(`[${name}]`, response?.status ?? error.message);
  return { ok: false, error: generic };
}
