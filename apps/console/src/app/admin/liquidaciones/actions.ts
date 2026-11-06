"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

/** Liquidaciones a los comercios (Política 9). La base de datos recalcula los montos y exige el rol y los plazos. */

const refresh = () => {
  revalidatePath("/admin/liquidaciones");
  revalidatePath("/comercio/liquidaciones");
};

export async function saveAgreement(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      commerceId: z.string().uuid(),
      commissionPct: z.number().min(0, "La comisión va de 0 a 100 %.").max(100, "La comisión va de 0 a 100 %."),
      periodDays: z.number().int().min(1, "Cada 1 a 15 días.").max(15, "La liquidación no puede pasar de 15 días (Norma 9.1.3)."),
      bearer: z.enum(["comercio", "rapitrip"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_commerce_agreement", { p_commerce: parsed.data.commerceId, p_commission_pct: parsed.data.commissionPct, p_period_days: parsed.data.periodDays, p_return_cost_bearer: parsed.data.bearer });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Convenio guardado." };
}

export async function recordSettlement(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ commerceId: z.string().uuid(), reference: z.string().trim().max(120).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("record_settlement", { p_commerce: parsed.data.commerceId, ...(parsed.data.reference ? { p_reference: parsed.data.reference } : {}) });
  if (error) return failure(error);
  refresh();
  const result = data as { number?: number } | null;
  return { ok: true, message: `Liquidación N.° ${result?.number ?? ""} registrada.` };
}

export async function recordReconciliation(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ month: z.string().regex(/^\d{4}-\d{2}$/), differences: z.string().trim().min(2, "Indica las diferencias (o «ninguna»).").max(2000), corrections: z.string().trim().max(2000).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("record_reconciliation", { p_month: `${parsed.data.month}-01`, p_differences: parsed.data.differences, ...(parsed.data.corrections ? { p_corrections: parsed.data.corrections } : {}) });
  if (error) return failure(error);
  refresh();
  return { ok: true, message: "Conciliación registrada." };
}
