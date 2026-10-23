import { z } from "zod";

/** Voucher del terminal o código de cobro: el voucher de tarjeta tiene entre 4 y 20 caracteres. */
export const voucherSchema = z.string().trim().min(4, "el voucher debe tener entre 4 y 20 caracteres").max(20, "el voucher debe tener entre 4 y 20 caracteres");

export const saleInputSchema = z
  .object({
    store: z.string().uuid(),
    method: z.enum(["efectivo", "tarjeta"]),
    items: z.array(z.object({ variant_id: z.string().uuid(), quantity: z.number().int().min(1).max(99) })).min(1).max(30),
    reference: z.string().optional(),
  })
  .superRefine((sale, ctx) => {
    if (sale.method !== "tarjeta") return;
    const parsed = voucherSchema.safeParse(sale.reference ?? "");
    if (!parsed.success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reference"], message: parsed.error.issues[0]?.message ?? "voucher inválido" });
  });

/** Lo que se envía a la base de datos: el voucher solo viaja con tarjeta. */
export function toSaleRpcArgs(sale: z.infer<typeof saleInputSchema>) {
  return {
    p_store: sale.store,
    p_items: sale.items,
    p_payment_method: sale.method,
    p_reference: sale.method === "tarjeta" ? sale.reference!.trim() : undefined,
  };
}
