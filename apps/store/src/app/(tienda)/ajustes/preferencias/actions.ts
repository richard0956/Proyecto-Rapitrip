"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

/** Enciende o apaga los correos de pedido («recibimos tu pedido», «tu pedido se canceló»). */
export async function setOrderEmails(input: unknown): Promise<CustomerResult> {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "No pudimos guardar la preferencia." };
  await requireCustomer("/ajustes/preferencias");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_my_notifications", { p_order_email: parsed.data.enabled });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath("/ajustes/preferencias");
  return { ok: true, message: parsed.data.enabled ? "Te avisaremos por correo de tus pedidos." : "Ya no te enviaremos correos de tus pedidos." };
}
