"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const uuid = z.string().uuid();
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Revisa los datos.";

function refresh() {
  revalidatePath("/coordinacion/efectivo");
  revalidatePath("/admin/efectivo");
}

/** Coordinación envía a una caja el efectivo de un repartidor SIN cuenta (quien tiene cuenta lo hace desde su aplicación). */
export async function startHandoffFor(courierId: string, sessionId: string): Promise<ActionResult> {
  const parsed = z.object({ courierId: uuid, sessionId: uuid }).safeParse({ courierId, sessionId });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("coordinacion");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("start_cash_handoff_for", { p_courier: parsed.data.courierId, p_session: parsed.data.sessionId });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

const decisionSchema = z.object({
  id: uuid,
  decision: z.enum(["sin_medida", "llamado_atencion", "reposicion", "suspension"]),
  note: z.string().trim().min(5, "explica la decisión (al menos 5 caracteres)").max(300),
});

/** La administración decide la medida de una responsabilidad de efectivo (Control 8.2.1: 5 días hábiles). */
export async function decideAccountability(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("decide_cash_accountability", { p_id: parsed.data.id, p_decision: parsed.data.decision, p_note: parsed.data.note });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

const settingsSchema = z.object({
  confirmMinutes: z.number().int().min(5, "entre 5 y 60 minutos").max(60, "entre 5 y 60 minutos"),
  maxHoldHours: z.number().int().min(1, "entre 1 y 24 horas").max(24, "entre 1 y 24 horas"),
  maxHoldAmount: z.number().min(100, "al menos 100").max(1_000_000, "hasta 1,000,000").multipleOf(0.01, "usa hasta dos decimales"),
});

export async function saveCashSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_cash_settings", { p_confirm_minutes: parsed.data.confirmMinutes, p_max_hold_hours: parsed.data.maxHoldHours, p_max_hold_amount: parsed.data.maxHoldAmount });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}

const registerSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "el nombre necesita al menos 2 caracteres").max(40),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,12}$/, "el código: de 3 a 12 letras, números o guiones").optional(),
  cashierId: uuid.nullable(),
  active: z.boolean(),
});

/** Crea o edita una caja física. El código no cambia después de crearla: es el que lleva la estación. */
export async function saveRegister(input: z.input<typeof registerSchema>): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { id, name, code, cashierId, active } = parsed.data;
  const { error } = id
    ? await supabase.rpc("update_cash_register", { p_id: id, p_name: name, p_cashier: cashierId as string, p_active: active })
    : await supabase.rpc("create_cash_register", { p_name: name, p_code: code ?? "", ...(cashierId ? { p_cashier: cashierId } : {}) });
  if (error) return failure(error);
  refresh();
  return { ok: true };
}
