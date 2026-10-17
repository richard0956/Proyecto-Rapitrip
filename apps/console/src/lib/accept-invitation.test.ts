import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acceptInvitation } from "./accept-invitation";

const token = "a".repeat(43);
const input = { token, password: "una-clave-larga", fullName: "Ana Pérez" };
const reply = (status: number, body: unknown = {}) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});
afterEach(() => vi.unstubAllEnvs());

describe("acceptInvitation", () => {
  it("envía token, contraseña y nombre a la función", async () => {
    const fetcher = reply(200, { ok: true });
    expect(await acceptInvitation(input, fetcher as unknown as typeof fetch)).toEqual({ ok: true });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:54321/functions/v1/accept-invitation");
    expect(JSON.parse(init.body)).toEqual({ token, password: "una-clave-larga", full_name: "Ana Pérez" });
  });

  it("rechaza una contraseña corta sin llamar al servidor", async () => {
    const fetcher = reply(200);
    const result = await acceptInvitation({ ...input, password: "corta" }, fetcher as unknown as typeof fetch);
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("explica una invitación vencida o usada", async () => {
    const result = await acceptInvitation(input, reply(410, { error: "x" }) as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("venció") });
  });

  it("no filtra errores internos del servidor", async () => {
    const result = await acceptInvitation(input, reply(500, { error: "detalle interno" }) as unknown as typeof fetch);
    expect(result).toMatchObject({ ok: false, message: expect.not.stringContaining("interno") });
  });
});
