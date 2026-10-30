"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

const PATH = "/ajustes/datos";

/** Pide eliminar la cuenta. La atiende el director desde la consola; mientras esté pendiente se puede cancelar. */
export async function requestDeletion(input: unknown): Promise<CustomerResult> {
  const parsed = z.object({ reason: z.string().trim().max(500).optional(), confirmed: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confirma que entiendes lo que pasa al eliminar la cuenta." };
  await requireCustomer(PATH);
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("request_account_deletion", { p_reason: (parsed.data.reason || null) as string });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath(PATH);
  return { ok: true, message: "Recibimos tu solicitud. El equipo de Rapitrip la revisará; mientras esté pendiente puedes cancelarla aquí." };
}

export async function cancelDeletion(): Promise<CustomerResult> {
  await requireCustomer(PATH);
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("cancel_account_deletion");
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath(PATH);
  return { ok: true, message: "Cancelamos tu solicitud. Tu cuenta sigue activa." };
}
