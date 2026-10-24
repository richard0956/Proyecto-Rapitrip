import { describe, expect, it, vi } from "vitest";
import { evidencePath, uploadEvidence } from "./evidence";
import type { QueueItem } from "./evidence-queue";
import type { Supabase } from "./client";

const base: QueueItem = {
  id: "11111111-1111-4111-8111-111111111111", orderId: "22222222-2222-4222-8222-222222222222", kind: "entrega",
  blob: new Blob(["foto"]), sha256: "b".repeat(64), latitude: 12.1366, longitude: -86.2515, units: null, note: null, createdAt: 1, attempts: 0, lastError: null,
};
const COURIER = "33333333-3333-4333-8333-333333333333";

function fake(upload: { error: { message: string; statusCode?: string } | null }, rpc: { error: { code?: string; message?: string } | null }) {
  const uploadFn = vi.fn().mockResolvedValue(upload);
  const rpcFn = vi.fn().mockResolvedValue(rpc);
  const supabase = { storage: { from: () => ({ upload: uploadFn }) }, rpc: rpcFn } as unknown as Supabase;
  return { supabase, uploadFn, rpcFn };
}

describe("evidencePath", () => {
  it("usa la forma que exige la base de datos: <ficha>/<pedido>/<tipo>-<id>.jpg", () => {
    expect(evidencePath(COURIER, base)).toBe(`${COURIER}/${base.orderId}/entrega-${base.id}.jpg`);
    expect(evidencePath(COURIER, base)).toMatch(new RegExp(`^${COURIER}/${base.orderId}/[A-Za-z0-9._-]{1,100}$`));
  });
});

describe("uploadEvidence", () => {
  it("sube la foto y registra la evidencia con ubicación", async () => {
    const { supabase, uploadFn, rpcFn } = fake({ error: null }, { error: null });
    expect(await uploadEvidence(supabase, COURIER, base)).toEqual({ ok: true });
    expect(uploadFn).toHaveBeenCalledWith(evidencePath(COURIER, base), base.blob, { contentType: "image/jpeg", upsert: false });
    expect(rpcFn).toHaveBeenCalledWith("courier_add_evidence", expect.objectContaining({ p_order: base.orderId, p_kind: "entrega", p_sha256: base.sha256, p_latitude: 12.1366, p_longitude: -86.2515 }));
  });

  it("sin ubicación no envía coordenadas", async () => {
    const { supabase, rpcFn } = fake({ error: null }, { error: null });
    await uploadEvidence(supabase, COURIER, { ...base, latitude: null, longitude: null });
    expect(rpcFn.mock.calls[0]?.[1]).not.toHaveProperty("p_latitude");
  });

  it("si la foto ya estaba subida (reintento) sigue con el registro", async () => {
    const { supabase, rpcFn } = fake({ error: { message: "The resource already exists", statusCode: "409" } }, { error: null });
    expect(await uploadEvidence(supabase, COURIER, base)).toEqual({ ok: true });
    expect(rpcFn).toHaveBeenCalled();
  });

  it("un fallo de subida por la red no es definitivo y no registra nada", async () => {
    const { supabase, rpcFn } = fake({ error: { message: "Failed to fetch" } }, { error: null });
    const result = await uploadEvidence(supabase, COURIER, base);
    expect(result).toMatchObject({ ok: false });
    expect((result as { permanent?: boolean }).permanent).toBeUndefined();
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it("un rechazo de la base de datos por estado inválido es definitivo", async () => {
    const { supabase } = fake({ error: null }, { error: { code: "22023", message: "este pedido no admite esa evidencia ahora" } });
    expect(await uploadEvidence(supabase, COURIER, base)).toEqual({ ok: false, error: "este pedido no admite esa evidencia ahora", permanent: true });
  });

  it("un error de sesión no se descarta: se reintenta después de ingresar", async () => {
    const { supabase } = fake({ error: null }, { error: { code: "42501", message: "x" } });
    const result = await uploadEvidence(supabase, COURIER, base);
    expect(result).toMatchObject({ ok: false, permanent: false });
  });
});
