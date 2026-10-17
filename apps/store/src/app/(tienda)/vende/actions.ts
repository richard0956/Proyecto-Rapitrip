"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { phoneSchema } from "@rapitrip/validation";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

const schema = z.object({
  businessName: z.string().trim().min(2, "Escribe el nombre de tu negocio.").max(150, "El nombre es demasiado largo."),
  contactName: z.string().trim().min(2, "Escribe el nombre del representante.").max(120),
  phone: phoneSchema,
  address: z.string().trim().min(5, "Escribe la dirección del negocio.").max(200),
  category: z.string().trim().min(2, "Escribe la categoría del negocio.").max(60),
});

/** Los datos del negocio viajan como `details` de la solicitud; la base de datos valida cuenta activa y correo confirmado. */
export async function submitCommerceRequest(input: unknown): Promise<CustomerResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireCustomer("/vende");
  const supabase = await serverSupabase();
  const { businessName, contactName, phone, address, category } = parsed.data;
  const { error } = await supabase.rpc("submit_commerce_request", {
    p_business_name: businessName,
    p_details: { contact_name: contactName, phone, address, category },
  });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  return { ok: true };
}
