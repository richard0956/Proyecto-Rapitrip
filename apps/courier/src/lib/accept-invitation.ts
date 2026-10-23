import { acceptInvitationSchema } from "@rapitrip/validation";

export type AcceptResult = { ok: true } | { ok: false; message: string };

const fallback = "No pudimos completar la invitación. Inténtalo de nuevo.";

/** Llama a la Edge Function `accept-invitation`. Solo muestra mensajes que la función diseñó para el usuario. */
export async function acceptInvitation(input: { token: string; password: string; fullName: string }, fetcher: typeof fetch = fetch): Promise<AcceptResult> {
  const parsed = acceptInvitationSchema.safeParse({ token: input.token, password: input.password, full_name: input.fullName || undefined });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? fallback };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, message: fallback };

  try {
    const response = await fetcher(`${url}/functions/v1/accept-invitation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify(parsed.data),
    });
    if (response.ok) return { ok: true };
    if (response.status === 410) return { ok: false, message: "La invitación no es válida o ya venció. Pide una nueva a coordinación." };
    if (response.status === 400 || response.status === 409) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (typeof body?.error === "string") return { ok: false, message: body.error };
    }
    return { ok: false, message: fallback };
  } catch {
    return { ok: false, message: fallback };
  }
}
