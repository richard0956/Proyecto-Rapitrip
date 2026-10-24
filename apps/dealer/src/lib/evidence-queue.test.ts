import { describe, expect, it } from "vitest";
import { flushQueue, MAX_ATTEMPTS, memoryStore, type QueueItem } from "./evidence-queue";

function item(id: string, createdAt: number, attempts = 0): QueueItem {
  return { id, orderId: "o1", kind: "recogida", blob: new Blob(["x"]), sha256: "a".repeat(64), latitude: null, longitude: null, units: null, note: null, createdAt, attempts, lastError: null };
}

describe("flushQueue", () => {
  it("sube en orden de captura y vacía la cola", async () => {
    const store = memoryStore();
    await store.put(item("b", 2));
    await store.put(item("a", 1));
    const order: string[] = [];
    const result = await flushQueue(store, async (i) => {
      order.push(i.id);
      return { ok: true };
    });
    expect(order).toEqual(["a", "b"]);
    expect(result).toMatchObject({ uploaded: 2, remaining: 0, dropped: [] });
  });

  it("si falla por la red deja ese elemento y corta (lo siguiente también fallaría)", async () => {
    const store = memoryStore();
    await store.put(item("a", 1));
    await store.put(item("b", 2));
    const seen: string[] = [];
    const result = await flushQueue(store, async (i) => {
      seen.push(i.id);
      return { ok: false, error: "Sin conexión" };
    });
    expect(seen).toEqual(["a"]);
    expect(result.uploaded).toBe(0);
    expect(result.remaining).toBe(2);
    const stored = (await store.all()).find((i) => i.id === "a");
    expect(stored).toMatchObject({ attempts: 1, lastError: "Sin conexión" });
  });

  it("un fallo definitivo se descarta y no traba lo siguiente", async () => {
    const store = memoryStore();
    await store.put(item("a", 1));
    await store.put(item("b", 2));
    const result = await flushQueue(store, async (i) => (i.id === "a" ? { ok: false, error: "el pedido ya cambió", permanent: true } : { ok: true }));
    expect(result.uploaded).toBe(1);
    expect(result.remaining).toBe(0);
    expect(result.dropped.map((d) => d.id)).toEqual(["a"]);
    expect(result.dropped[0]?.lastError).toBe("el pedido ya cambió");
  });

  it("tras demasiados intentos deja de reintentar", async () => {
    const store = memoryStore();
    await store.put(item("a", 1, MAX_ATTEMPTS - 1));
    const result = await flushQueue(store, async () => ({ ok: false, error: "Sin conexión" }));
    expect(result.dropped).toHaveLength(1);
    expect(result.remaining).toBe(0);
  });

  it("una cola vacía no hace nada", async () => {
    const result = await flushQueue(memoryStore(), async () => ({ ok: true }));
    expect(result).toEqual({ uploaded: 0, remaining: 0, dropped: [] });
  });
});
