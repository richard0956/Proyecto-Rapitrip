import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));
vi.mock("@rapitrip/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth: { signUp } }) }));

import { LEGAL_VERSION } from "@/lib/legal";
import { SignupForm } from "./signup-form";

async function fill(overrides: { password?: string; confirm?: string; accept?: boolean } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
  await user.type(screen.getByLabelText("Correo"), "ana@correo.test");
  await user.type(screen.getByLabelText("Contraseña"), overrides.password ?? "clave-segura");
  await user.type(screen.getByLabelText("Repite la contraseña"), overrides.confirm ?? "clave-segura");
  if (overrides.accept !== false) await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
}

beforeEach(() => vi.clearAllMocks());

describe("SignupForm", () => {
  it("envía el nombre como metadato y confirma sin revelar si el correo existía", async () => {
    signUp.mockResolvedValue({ error: null });
    render(<SignupForm next="/vende" />);
    await fill();
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@correo.test", options: expect.objectContaining({ data: expect.objectContaining({ full_name: "Ana Pérez", terms_version: LEGAL_VERSION, terms_accepted_at: expect.any(String) }) }) }));
    expect(await screen.findByRole("status")).toHaveTextContent("Si ana@correo.test no tenía cuenta");
  });

  it("no envía si las contraseñas no coinciden", async () => {
    render(<SignupForm next="/" />);
    await fill({ confirm: "otra-clave-1" });
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("no crea la cuenta sin aceptar los términos", async () => {
    render(<SignupForm next="/" />);
    await fill({ accept: false });
    expect(screen.getByText(/Acepta los términos/)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña corta", async () => {
    render(<SignupForm next="/" />);
    await fill({ password: "corta", confirm: "corta" });
    expect(screen.getByText(/entre 8 y 72/)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("muestra un error genérico si Auth falla", async () => {
    signUp.mockResolvedValue({ error: { message: "User already registered" } });
    render(<SignupForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos crear la cuenta");
    expect(screen.getByRole("alert")).not.toHaveTextContent("already");
  });
});
