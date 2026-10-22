"use server";

import { productDeliverySchema, productSchema, reasonSchema, variantSchema } from "@rapitrip/validation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalidInput, type ActionResult } from "@/lib/action-error";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const idSchema = z.string().uuid();
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Revisa los datos.";

function refresh(productId?: string) {
  revalidatePath("/comercio");
  revalidatePath("/comercio/catalogo");
  if (productId) revalidatePath(`/comercio/catalogo/${productId}`);
}

export type CreateProductResult = { ok: true; id: string } | { ok: false; error: string };

export async function createProduct(storeId: string, input: unknown): Promise<CreateProductResult> {
  const parsedStore = idSchema.safeParse(storeId);
  const parsed = productSchema.safeParse(input);
  if (!parsedStore.success) return invalidInput as { ok: false; error: string };
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("create_product", {
    p_store: parsedStore.data,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? undefined,
    p_category: parsed.data.category_id ?? undefined,
    p_brand: parsed.data.brand_id ?? undefined,
    p_type: parsed.data.product_type_id ?? undefined,
  });
  if (error) return failure(error) as { ok: false; error: string };
  refresh();
  return { ok: true, id: data };
}

export async function updateProduct(id: string, input: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = productSchema.safeParse(input);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("update_product", {
    p_product: parsedId.data,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? undefined,
    p_category: parsed.data.category_id ?? undefined,
    p_brand: parsed.data.brand_id ?? undefined,
    p_type: parsed.data.product_type_id ?? undefined,
  });
  if (error) return failure(error);
  refresh(parsedId.data);
  return { ok: true };
}

/** Peso, medidas y tipo de entrega del producto. La base de datos vuelve a validar los límites vigentes de express. */
export async function setProductDelivery(id: string, input: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = productDeliverySchema.safeParse(input);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  // Los nulos viajan como nulos: la función no tiene valores por defecto para el peso ni las medidas.
  const orNull = (value: number | null) => value as unknown as number;
  const { error } = await supabase.rpc("set_product_delivery", {
    p_product: parsedId.data,
    p_eligible: parsed.data.express_eligible,
    p_weight_kg: orNull(parsed.data.weight_kg),
    p_length_cm: orNull(parsed.data.length_cm),
    p_width_cm: orNull(parsed.data.width_cm),
    p_height_cm: orNull(parsed.data.height_cm),
    p_validation_days: parsed.data.validation_days ?? undefined,
  });
  if (error) return failure(error);
  refresh(parsedId.data);
  return { ok: true };
}

export async function setProductStatus(id: string, input: { status: "borrador" | "publicado" | "archivado"; reason?: string }): Promise<ActionResult> {
  const parsed = z
    .object({ id: idSchema, status: z.enum(["borrador", "publicado", "archivado"]), reason: reasonSchema.optional() })
    .refine((value) => value.status !== "archivado" || value.reason !== undefined, "indica el motivo")
    .safeParse({ id, ...input });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_product_status", { p_product: parsed.data.id, p_status: parsed.data.status, p_reason: parsed.data.reason });
  if (error) return failure(error);
  refresh(parsed.data.id);
  return { ok: true };
}

export async function createVariant(productId: string, input: unknown): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(productId);
  const parsed = variantSchema.safeParse(input);
  if (!parsedId.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("create_variant", { p_product: parsedId.data, p_name: parsed.data.name, p_sku: parsed.data.sku, p_price: parsed.data.price });
  if (error) return failure(error);
  refresh(parsedId.data);
  return { ok: true };
}

export async function updateVariant(productId: string, variantId: string, input: unknown): Promise<ActionResult> {
  const parsedProduct = idSchema.safeParse(productId);
  const parsedVariant = idSchema.safeParse(variantId);
  const parsed = variantSchema.safeParse(input);
  if (!parsedProduct.success || !parsedVariant.success) return invalidInput;
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("update_variant", { p_variant: parsedVariant.data, p_name: parsed.data.name, p_sku: parsed.data.sku, p_price: parsed.data.price });
  if (error) return failure(error);
  refresh(parsedProduct.data);
  return { ok: true };
}

/** Quita el descuento de una presentación: queda el precio actual como precio normal. */
export async function removeVariantDiscount(productId: string, variantId: string): Promise<ActionResult> {
  const parsed = z.object({ product: idSchema, variant: idSchema }).safeParse({ product: productId, variant: variantId });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("remove_variant_discount", { p_variant: parsed.data.variant });
  if (error) return failure(error);
  refresh(parsed.data.product);
  return { ok: true };
}

export async function setVariantStatus(productId: string, variantId: string, status: "activa" | "inactiva"): Promise<ActionResult> {
  const parsed = z.object({ product: idSchema, variant: idSchema, status: z.enum(["activa", "inactiva"]) }).safeParse({ product: productId, variant: variantId, status });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("set_variant_status", { p_variant: parsed.data.variant, p_status: parsed.data.status });
  if (error) return failure(error);
  refresh(parsed.data.product);
  return { ok: true };
}

/** La imagen ya se subió desde el navegador; aquí se registra. Si falla, el cliente borra el archivo. */
export async function addProductImage(productId: string, path: string): Promise<ActionResult> {
  const parsed = z.object({ product: idSchema, path: z.string().max(300) }).safeParse({ product: productId, path });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { error } = await supabase.rpc("add_product_image", { p_product: parsed.data.product, p_path: parsed.data.path });
  if (error) return failure(error);
  refresh(parsed.data.product);
  return { ok: true };
}

export async function removeProductImage(productId: string, imageId: string): Promise<ActionResult> {
  const parsed = z.object({ product: idSchema, image: idSchema }).safeParse({ product: productId, image: imageId });
  if (!parsed.success) return invalidInput;
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const { data: path, error } = await supabase.rpc("remove_product_image", { p_image: parsed.data.image });
  if (error) return failure(error);
  // El registro ya no existe; si el borrado del archivo falla queda un archivo huérfano sin enlace, sin efecto visible.
  const removed = await supabase.storage.from("product-images").remove([path]);
  if (removed.error) console.error("[imagen:borrado]", removed.error.message);
  refresh(parsed.data.product);
  return { ok: true };
}
