"use server";

import { failure, isSessionExpired } from "@rapitrip/supabase";
import { customerAddressSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expiredResult, type CustomerResult } from "@/lib/result";
import { requireCustomer } from "@/lib/session";
import { serverSupabase } from "@/lib/supabase";

const PATH = "/perfil/direcciones";

/** Crea (sin `id`) o edita una dirección propia. Las coordenadas del mapa se aceptan pero hoy ninguna pantalla las envía. */
export async function saveAddress(input: unknown): Promise<CustomerResult> {
  const parsed = customerAddressSchema.safeParse(input);
  const idParsed = z.object({ id: z.string().uuid().nullable().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  if (!idParsed.success) return { ok: false, error: "Dirección inválida." };
  await requireCustomer(PATH);
  const supabase = await serverSupabase();
  const { id } = idParsed.data;
  const { label, address, reference, phone, make_default, latitude, longitude } = parsed.data;
  const { error } = await supabase.rpc("save_address", {
    p_id: (id ?? null) as string,
    p_label: label,
    p_address: address,
    p_reference: (reference ?? null) as string,
    p_phone: (phone ?? null) as string,
    p_make_default: make_default,
    p_latitude: (latitude ?? null) as number,
    p_longitude: (longitude ?? null) as number,
  });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath(PATH);
  return { ok: true, message: id ? "Dirección actualizada." : "Dirección guardada." };
}

export async function setDefaultAddress(id: string): Promise<CustomerResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Dirección inválida." };
  await requireCustomer(PATH);
  const { error } = await (await serverSupabase()).rpc("set_default_address", { p_id: id });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath(PATH);
  return { ok: true, message: "Dirección predeterminada actualizada." };
}

export async function deleteAddress(id: string): Promise<CustomerResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Dirección inválida." };
  await requireCustomer(PATH);
  const { error } = await (await serverSupabase()).rpc("delete_address", { p_id: id });
  if (isSessionExpired(error)) return expiredResult;
  if (error) return failure(error);
  revalidatePath(PATH);
  return { ok: true, message: "Dirección eliminada." };
}
