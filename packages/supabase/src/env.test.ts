import { afterEach, describe, expect, it, vi } from "vitest";
import { publicEnv } from "./env";

describe("publicEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("exige URL y clave", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => publicEnv()).toThrow();
  });

  it("toma el nombre de cookie propio de cada app, o ninguno", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    vi.stubEnv("NEXT_PUBLIC_AUTH_COOKIE_NAME", "rapitrip-console-auth");
    expect(publicEnv().cookieName).toBe("rapitrip-console-auth");
    vi.stubEnv("NEXT_PUBLIC_AUTH_COOKIE_NAME", "");
    expect(publicEnv().cookieName).toBeUndefined();
  });
});
