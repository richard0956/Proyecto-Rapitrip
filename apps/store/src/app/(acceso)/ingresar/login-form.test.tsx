import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, signInWithPassword } = vi.hoisted(() => ({ replace: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));
vi.mock("@rapitrip/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth: { signInWithPassword } }) }));

import { LoginForm } from "./login-form";

async function fill(email = "ana@correo.test") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Correo"), email);
  await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
}

beforeEach(() => vi.clearAllMocks());

describe("LoginForm de la tienda", () => {
  it("lleva al destino tras ingresar", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    render(<LoginForm next="/vende" />);
    await fill();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/vende"));
  });

  it("pide confirmar el correo si Auth lo indica", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed", message: "Email not confirmed" } });
    render(<LoginForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirma tu correo");
    expect(replace).not.toHaveBeenCalled();
  });

  it("muestra un error genérico con credenciales incorrectas", async () => {
    signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login credentials" } });
    render(<LoginForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Invalid");
  });

  it("valida el correo antes de llamar al servidor", async () => {
    render(<LoginForm next="/" />);
    await fill("no-es-correo");
    expect(screen.getByText("Escribe un correo válido.")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
