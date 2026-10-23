"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { phoneSchema } from "@rapitrip/validation";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

const schema = z
  .object({
    businessKind: z.enum(["informal", "empresa"]).default("informal"),
    ruc: z.string().trim().max(40).default(""),
    cedula: z.string().trim().max(40).default(""),
    email: z.string().trim().email("Escribe un correo válido.").max(120),
    description: z.string().trim().min(10, "Describe tu negocio y tus productos (mínimo 10 caracteres).").max(500, "La descripción es demasiado larga."),
  businessName: z.string().trim().min(2, "Escribe el nombre de tu negocio.").max(150, "El nombre es demasiado largo."),
  contactName: z.string().trim().min(2, "Escribe el nombre del representante.").max(120),
  phone: phoneSchema,
  address: z.string().trim().min(5, "Escribe la dirección del negocio.").max(200),
  category: z.string().trim().min(2, "Escribe la categoría del negocio.").max(60),
  })
  .superRefine((value, ctx) => {
    if (value.businessKind !== "empresa") {
      const cedula = value.cedula.replace(/[\s.-]/g, "").toUpperCase();
      if (!/^[A-Z0-9]{8,20}$/.test(cedula)) ctx.addIssue({ code: "custom", path: ["cedula"], message: "La cédula debe tener entre 8 y 20 letras o números." });
      return;
    }
    // Mismo criterio que la base de datos: sin espacios, puntos ni guiones, de 8 a 20 letras o números.
    const ruc = value.ruc.replace(/[\s.-]/g, "").toUpperCase();
    if (!/^[A-Z0-9]{8,20}$/.test(ruc)) ctx.addIssue({ code: "custom", path: ["ruc"], message: "El RUC debe tener entre 8 y 20 letras o números." });
  });

/** Los datos del negocio viajan como `details` de la solicitud; la base de datos valida cuenta activa y correo confirmado. */
export async function submitCommerceRequest(input: unknown): Promise<CustomerResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  await requireCustomer("/vende");
  const supabase = await serverSupabase();
  const { businessName, contactName, phone, email, address, category, description, businessKind, ruc, cedula } = parsed.data;
  const { error } = await supabase.rpc("submit_commerce_request", {
    p_business_name: businessName,
    p_details: { contact_name: contactName, phone, email, address, category, description, business_kind: businessKind, ...(businessKind === "empresa" ? { ruc } : { cedula: cedula.replace(/[\s.-]/g, "").toUpperCase() }) },
  });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  return { ok: true };
}
