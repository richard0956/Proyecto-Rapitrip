import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, signIn, setSession } = vi.hoisted(() => ({ replace: vi.fn(), signIn: vi.fn(), setSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
vi.mock("@rapitrip/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth: { setSession } }) }));
vi.mock("./actions", () => ({ signInWithPasswordAction: signIn }));

import { LoginForm } from "./login-form";

async function fill(email = "ana@correo.test") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Correo"), email);
  await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  setSession.mockResolvedValue({ error: null });
});

describe("LoginForm de la tienda", () => {
  it("lleva al destino tras ingresar", async () => {
    signIn.mockResolvedValue({ ok: true, session: { access_token: "a", refresh_token: "r" } });
    render(<LoginForm next="/vende" />);
    await fill();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/vende"));
    expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
  });

  it("pide confirmar el correo si Auth lo indica", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "email_not_confirmed", message: null });
    render(<LoginForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirma tu correo");
    expect(replace).not.toHaveBeenCalled();
  });

  it("muestra un error genérico con credenciales incorrectas", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "invalid", message: "No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo." });
    render(<LoginForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión");
  });

  it("avisa del último intento y luego del bloqueo", async () => {
    signIn.mockResolvedValueOnce({ ok: false, reason: "invalid", message: "No pudimos iniciar sesión. Te queda un último intento: si vuelves a fallar, el acceso a esta cuenta se bloqueará por 15 minutos." });
    render(<LoginForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Te queda un último intento");

    signIn.mockResolvedValueOnce({ ok: false, reason: "locked", message: "Por seguridad bloqueamos el acceso a esta cuenta tras varios intentos fallidos. Inténtalo de nuevo en 15 minutos." });
    await userEvent.setup().click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText(/Inténtalo de nuevo en 15 minutos/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("valida el correo antes de llamar al servidor", async () => {
    render(<LoginForm next="/" />);
    await fill("no-es-correo");
    expect(screen.getByText("Escribe un correo válido.")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});
