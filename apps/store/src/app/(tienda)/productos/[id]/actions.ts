"use server";

import { failure, getSessionInfo, isSessionExpired } from "@rapitrip/supabase";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { serverSupabase } from "@/lib/supabase";

const reportSchema = z.object({
  productId: z.string().uuid(),
  kind: z.enum(["precio", "disponibilidad", "descripcion", "imagen", "otro"], { message: "Elige qué no coincide." }),
  description: z.string().trim().min(10, "Cuéntanos qué no coincide (mínimo 10 caracteres).").max(500, "Hasta 500 caracteres."),
});

/**
 * Norma 8.2 del manual de políticas de TI: un cliente reporta que el catálogo no coincide con lo que ofrece el comercio. El
 * equipo de Rapitrip lo revisa en 24 horas y, si se confirma, el comercio lo corrige.
 */
export async function reportCatalogIssue(input: unknown): Promise<CustomerResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  if (!session.signedIn) return { ok: false, error: "Ingresa a tu cuenta para enviar el reporte.", expired: true };
  const { error } = await supabase.rpc("report_catalog_issue", { p_product: parsed.data.productId, p_kind: parsed.data.kind, p_description: parsed.data.description });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  return { ok: true, message: "Gracias. El equipo de Rapitrip lo revisará en un máximo de 24 horas." };
}
