import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh, signIn, getClaims, signOut } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), signIn: vi.fn(), getClaims: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("@/lib/client", () => ({ getSupabase: () => ({ auth: { signInWithPassword: signIn, getClaims, signOut } }) }));

import { LoginForm } from "./login-form";

beforeEach(() => {
  vi.clearAllMocks();
  signIn.mockResolvedValue({ error: null });
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
    expect(signOut).not.toHaveBeenCalled();
  });

  it("una cuenta sin rol de repartidor no entra: se cierra su sesión y se explica", async () => {
    getClaims.mockResolvedValue({ data: { claims: { app_roles: [{ role: "cliente" }] } } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/no tiene acceso de repartidor/);
    expect(signOut).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("datos incorrectos dan un mensaje genérico", async () => {
    signIn.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login credentials" } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar sesión");
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("sin señal lo dice", async () => {
    signIn.mockResolvedValue({ error: { message: "Failed to fetch" } });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
  });

  it("un correo inválido no llama al servidor", async () => {
    await submit("no-es-correo", "secreta123");
    expect(await screen.findByText("Escribe un correo válido.")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });
});
