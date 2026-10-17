import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "./site-url";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("usa la variable cuando es una URL válida", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tienda.rapitrip.test/ruta");
    expect(siteUrl()).toBe("https://tienda.rapitrip.test");
  });

  it("trata una variable vacía como ausente", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("ignora un valor que no es una URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "no-es-una-url");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
