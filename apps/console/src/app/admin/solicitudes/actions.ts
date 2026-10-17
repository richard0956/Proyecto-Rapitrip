"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

export async function approveRequest(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), convenio: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confirma que el convenio está firmado para aprobar." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("approve_commerce_request", { p_request: parsed.data.id, p_convenio_confirmed: true });
  if (error) return failure(error);
  revalidatePath("/admin/solicitudes");
  return { ok: true };
}

export async function rejectRequest(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid(), reason: z.string().trim().min(10).max(500) }).safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("reject_commerce_request", { p_request: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/admin/solicitudes");
  return { ok: true };
}
