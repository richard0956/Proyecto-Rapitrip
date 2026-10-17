"use server";

import { appRoleSchema, inviteStaffSchema, reasonSchema, strongReasonSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { invokeFunction } from "@/lib/functions";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const changeSchema = z.object({
  userId: z.string().uuid(),
  role: appRoleSchema,
  to: z.enum(["activo", "suspendido", "revocado"]),
  reason: reasonSchema,
});

const rpcByTarget = { activo: "reactivate_role", suspendido: "suspend_role", revocado: "revoke_role" } as const;

export async function changeRoleStatus(input: unknown): Promise<ActionResult> {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc(rpcByTarget[parsed.data.to], {
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function resetMfa(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ userId: z.string().uuid(), reason: strongReasonSchema }).safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("reset_mfa", { p_target: parsed.data.userId, p_reason: parsed.data.reason });
  if (error) return failure(error);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function cancelInvitation(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("cancel_invitation", { p_id: parsed.data.id });
  if (error) return failure(error);
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/** Invoca la Edge Function con el token de quien invita: el rol, la matriz y la sesión se validan en la RPC. */
export async function inviteStaff(input: unknown): Promise<ActionResult> {
  const parsed = inviteStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Escribe un correo válido y elige un rol." };
  await requireConsoleAccess("admin");
  const result = await invokeFunction("invite-staff", parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Invitación enviada." };
}
