import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const { exchange, server } = vi.hoisted(() => ({ exchange: vi.fn(), server: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ serverSupabase: server }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tienda.rapitrip.test");
  server.mockResolvedValue({ auth: { exchangeCodeForSession: exchange } });
  exchange.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("callback detrás del proxy", () => {
  it("devuelve la sesión al dominio público, aunque el servidor reciba la URL interna", async () => {
    const response = await GET(new NextRequest("http://0.0.0.0:3000/auth/callback?code=oauth-code&next=%2Fajustes"));
    expect(exchange).toHaveBeenCalledWith("oauth-code");
    expect(response.headers.get("location")).toBe("https://tienda.rapitrip.test/ajustes");
  });

  it("mantiene los destinos externos fuera del callback e ignora un host reenviado ajeno", async () => {
    const response = await GET(new NextRequest("http://0.0.0.0:3000/auth/callback?code=oauth-code&next=%2F%2Fevil.test", { headers: { "x-forwarded-host": "evil.test" } }));
    expect(response.headers.get("location")).toBe("https://tienda.rapitrip.test/");
  });

  it("devuelve los enlaces incompletos al ingreso público", async () => {
    const response = await GET(new NextRequest("http://0.0.0.0:3000/auth/callback"));
    expect(response.headers.get("location")).toBe("https://tienda.rapitrip.test/ingresar?error=enlace");
    expect(server).not.toHaveBeenCalled();
  });

  it("conserva la confirmación de correo y los parámetros del destino en el dominio público", async () => {
    const response = await GET(new NextRequest("http://0.0.0.0:3000/auth/callback?message=confirmed&next=%2Fajustes%3Fvista%3Dperfil"));
    expect(response.headers.get("location")).toBe("https://tienda.rapitrip.test/ajustes?vista=perfil&correo=pendiente");
  });
});
