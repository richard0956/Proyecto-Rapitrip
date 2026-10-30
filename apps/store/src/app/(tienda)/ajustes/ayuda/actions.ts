"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

const schema = z.object({
  topic: z.enum(["compra", "entrega", "app", "otro"]),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(5, "Escribe al menos 5 caracteres.").max(1000, "El comentario admite hasta 1000 caracteres."),
});

/** Envía un comentario con calificación. Lo lee la administración desde la consola. */
export async function sendFeedback(input: unknown): Promise<CustomerResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa el comentario." };
  await requireCustomer("/ajustes/ayuda");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("send_feedback", { p_topic: parsed.data.topic, p_rating: parsed.data.rating, p_message: parsed.data.message });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  return { ok: true, message: "¡Gracias! Recibimos tu comentario." };
}
