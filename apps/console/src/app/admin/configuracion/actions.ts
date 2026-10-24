"use server";

import { revalidatePath } from "next/cache";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { evidenceSettingsSchema } from "@/lib/evidence-settings";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

/** Qué evidencia se exige a los repartidores y cuánto se conservan las fotos. La base de datos vuelve a validar y audita el cambio. */
export async function saveEvidenceSettings(input: unknown): Promise<ActionResult> {
  const parsed = evidenceSettingsSchema.safeParse(input);
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_evidence_settings", {
    p_pickup_photo: parsed.data.pickupPhoto,
    p_delivery_photo: parsed.data.deliveryPhoto,
    p_pickup_code: parsed.data.pickupCode,
    p_delivery_code: parsed.data.deliveryCode,
    p_alert_distance_m: parsed.data.alertDistanceM,
    p_retention_days: parsed.data.retentionDays,
  });
  if (error) return failure(error);
  revalidatePath("/admin/configuracion");
  return { ok: true, message: "Guardamos las reglas." };
}
