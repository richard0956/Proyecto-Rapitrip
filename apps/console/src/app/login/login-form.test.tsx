import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, signInWithPassword, getSessionInfo } = vi.hoisted(() => ({ replace: vi.fn(), signInWithPassword: vi.fn(), getSessionInfo: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
vi.mock("@rapitrip/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth: { signInWithPassword } }) }));
vi.mock("@rapitrip/supabase", async (importOriginal) => ({ ...(await importOriginal<object>()), getSessionInfo }));

import { LoginForm } from "./login-form";

async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Correo"), "ana@rapitrip.test");
  await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
}

beforeEach(() => vi.clearAllMocks());

describe("LoginForm", () => {
  it("lleva a /mfa tras un ingreso correcto con rol de consola", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    getSessionInfo.mockResolvedValue({ role: "admin" });
    render(<LoginForm />);
    await fill();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mfa"));
  });

  it("muestra un error genérico si las credenciales fallan", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Invalid");
    expect(replace).not.toHaveBeenCalled();
  });

  it("valida el formato del correo antes de llamar al servidor", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Correo"), "no-es-correo");
    await user.type(screen.getByLabelText("Contraseña"), "x");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(screen.getByText("Escribe un correo válido.")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
