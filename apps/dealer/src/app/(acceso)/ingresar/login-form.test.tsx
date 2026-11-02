import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh, signIn, setSession, getClaims, signOut } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  setSession: vi.fn(),
  getClaims: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/client", () => ({ getSupabase: () => ({ auth: { setSession, getClaims, signOut } }) }));
vi.mock("./actions", () => ({ signInWithPasswordAction: signIn }));

import { LoginForm } from "./login-form";

beforeEach(() => {
  vi.clearAllMocks();
  signIn.mockResolvedValue({ ok: true, session: { access_token: "a", refresh_token: "r" } });
  setSession.mockResolvedValue({ error: null });
  signOut.mockResolvedValue({});
});

async function submit(email = "rep@t.test", password = "secreta123") {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText("Correo"), email);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
}

describe("LoginForm", () => {
  it("una cuenta de repartidor entra al inicio", async () => {
    getClaims.mockResolvedValue({ data: { claims: { app_roles: [{ role: "repartidor" }] } } });
    await submit();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(signIn).toHaveBeenCalledWith("rep@t.test", "secreta123", null);
    expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("una cuenta sin rol de repartidor no entra: se cierra su sesión y se explica", async () => {
    getClaims.mockResolvedValue({ data: { claims: { app_roles: [{ role: "cliente" }] } } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/no tiene acceso de repartidor/);
    expect(signOut).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("datos incorrectos dan el mensaje del servidor", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "invalid", message: "No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo." });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión");
    expect(setSession).not.toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("avisa cuando queda un último intento", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "invalid", message: "No pudimos iniciar sesión. Te queda un último intento: si vuelves a fallar, el acceso a esta cuenta se bloqueará por 15 minutos." });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Te queda un último intento");
  });

  it("con la cuenta bloqueada dice cuántos minutos faltan", async () => {
    signIn.mockResolvedValue({ ok: false, reason: "locked", message: "Por seguridad bloqueamos el acceso a esta cuenta tras varios intentos fallidos. Inténtalo de nuevo en 1 minuto." });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Inténtalo de nuevo en 1 minuto");
  });

  it("sin señal lo dice", async () => {
    signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
  });

  it("un correo inválido no llama al servidor", async () => {
    await submit("no-es-correo", "secreta123");
    expect(await screen.findByText("Escribe un correo válido.")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});
