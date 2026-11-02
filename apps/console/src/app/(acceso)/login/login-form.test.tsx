import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, signIn, setSession, getSessionInfo } = vi.hoisted(() => ({ replace: vi.fn(), signIn: vi.fn(), setSession: vi.fn(), getSessionInfo: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
vi.mock("@rapitrip/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth: { setSession } }) }));
vi.mock("@rapitrip/supabase", async (importOriginal) => ({ ...(await importOriginal<object>()), getSessionInfo }));
vi.mock("./actions", () => ({ signInWithPasswordAction: signIn }));

import { LoginForm } from "./login-form";

const session = { access_token: "a", refresh_token: "r" };

async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Correo"), "Ana@rapitrip.test");
  await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
  await user.click(screen.getByRole("button", { name: "Ingresar a la consola" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  setSession.mockResolvedValue({ error: null });
});

describe("LoginForm", () => {
  it("lleva a /mfa tras un ingreso correcto con rol de consola", async () => {
    signIn.mockResolvedValue({ ok: true, session });
    getSessionInfo.mockResolvedValue({ role: "admin" });
    render(<LoginForm />);
    await fill();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mfa"));
    expect(signIn).toHaveBeenCalledWith("ana@rapitrip.test", "clave-segura", null);
    expect(setSession).toHaveBeenCalledWith(session);
  });

  it("muestra el mensaje del servidor si las credenciales fallan", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "invalid", message: "No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo." });
    render(<LoginForm />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión");
    expect(setSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("avisa cuando queda un último intento", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "invalid", message: "No pudimos iniciar sesión. Te queda un último intento: si vuelves a fallar, el acceso a esta cuenta se bloqueará por 15 minutos." });
    render(<LoginForm />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Te queda un último intento");
  });

  it("muestra el bloqueo con los minutos que faltan", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "locked", message: "Por seguridad bloqueamos el acceso a esta cuenta tras varios intentos fallidos. Inténtalo de nuevo en 12 minutos." });
    render(<LoginForm />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Inténtalo de nuevo en 12 minutos");
  });

  it("si el servidor no responde da el error genérico", async () => {
    signIn.mockRejectedValue(new Error("Failed to fetch"));
    render(<LoginForm />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión");
    expect(screen.getByRole("alert")).not.toHaveTextContent("fetch");
  });

  it("valida el formato del correo antes de llamar al servidor", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Correo"), "no-es-correo");
    await user.type(screen.getByLabelText("Contraseña"), "x");
    await user.click(screen.getByRole("button", { name: "Ingresar a la consola" }));
    expect(screen.getByText("Escribe un correo válido.")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});
