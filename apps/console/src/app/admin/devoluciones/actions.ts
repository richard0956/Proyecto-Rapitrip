"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const decisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["aprobada", "rechazada"]),
  note: z.string().trim().min(5, "explica la decisión (mínimo 5 caracteres)").max(200),
});

/** Aprueba o rechaza una devolución. Solo administración; la base de datos vuelve a comprobarlo. */
export async function decideReturn(input: { id: string; decision: "aprobada" | "rechazada"; note: string }): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa la decisión." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("decide_return", { p_request: parsed.data.id, p_decision: parsed.data.decision, p_note: parsed.data.note });
  if (error) return failure(error);
  revalidatePath("/admin/devoluciones");
  return { ok: true };
}
