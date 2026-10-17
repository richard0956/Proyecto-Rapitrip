"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { fullNameSchema, phoneSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

const schema = z.object({ fullName: fullNameSchema, phone: z.union([phoneSchema, z.literal("")]) });

export async function updateProfile(input: unknown): Promise<CustomerResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireCustomer("/perfil");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: parsed.data.fullName,
    // La función acepta null para borrar el teléfono; los tipos generados no marcan el argumento como nulo.
    p_phone: (parsed.data.phone || null) as string,
  });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath("/perfil");
  return { ok: true, message: "Datos guardados." };
}
