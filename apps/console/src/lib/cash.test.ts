import { describe, expect, it } from "vitest";
import { saleInputSchema, toSaleRpcArgs } from "./cash";

const store = "11111111-1111-4111-8111-111111111111";
const variant = "22222222-2222-4222-8222-222222222222";
const items = [{ variant_id: variant, quantity: 1 }];

describe("saleInputSchema", () => {
  it("pide voucher para tarjeta de mostrador", () => {
    const parsed = saleInputSchema.safeParse({ store, method: "tarjeta", items });
    expect(parsed.success).toBe(false);
  });

  it("rechaza un voucher de 3 caracteres", () => {
    const parsed = saleInputSchema.safeParse({ store, method: "tarjeta", items, reference: "ABC" });
    expect(parsed.success).toBe(false);
  });

  it("acepta un voucher de 4 caracteres", () => {
    const parsed = saleInputSchema.safeParse({ store, method: "tarjeta", items, reference: "VCH1" });
    expect(parsed.success).toBe(true);
  });

  it("no pide voucher en efectivo", () => {
    const parsed = saleInputSchema.safeParse({ store, method: "efectivo", items });
    expect(parsed.success).toBe(true);
  });
});

describe("toSaleRpcArgs", () => {
  it("manda el voucher recortado solo con tarjeta", () => {
    const sale = saleInputSchema.parse({ store, method: "tarjeta", items, reference: "  VCH1  " });
    expect(toSaleRpcArgs(sale).p_reference).toBe("VCH1");
  });

  it("no manda referencia en efectivo", () => {
    const sale = saleInputSchema.parse({ store, method: "efectivo", items, reference: "VCH1" });
    expect(toSaleRpcArgs(sale).p_reference).toBeUndefined();
  });
});
