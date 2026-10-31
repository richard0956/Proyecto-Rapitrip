import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signUp, verifyOtp, resend, replace, refresh } = vi.hoisted(() => ({ signUp: vi.fn(), verifyOtp: vi.fn(), resend: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@rapitrip/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth: { signUp, verifyOtp, resend } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { LEGAL_VERSION } from "@/lib/legal";
import { SignupForm } from "./signup-form";

async function fill(overrides: { password?: string; confirm?: string; accept?: boolean } = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
  await user.type(screen.getByLabelText("Correo"), "ana@correo.test");
  await user.type(screen.getByLabelText("Contraseña"), overrides.password ?? "Clave-segura1");
  await user.type(screen.getByLabelText("Repite la contraseña"), overrides.confirm ?? "Clave-segura1");
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

  it("tras registrarse pide el código de 6 dígitos y, si es correcto, confirma el correo y sigue a donde iba", async () => {
    signUp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    render(<SignupForm next="/vende" />);
    await fill();
    const user = userEvent.setup();
    const verify = await screen.findByRole("button", { name: "Verificar correo" });
    expect(verify).toBeDisabled();
    await user.type(screen.getByLabelText("Código de verificación"), "123 456");
    await user.click(verify);
    expect(verifyOtp).toHaveBeenCalledWith({ email: "ana@correo.test", token: "123456", type: "signup" });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/vende"));
    expect(refresh).toHaveBeenCalled();
  });

  it("un código incorrecto o vencido muestra el error y no avanza", async () => {
    signUp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid", code: "otp_expired" } });
    render(<SignupForm next="/" />);
    await fill();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Código de verificación"), "000000");
    await user.click(screen.getByRole("button", { name: "Verificar correo" }));
    expect(await screen.findByText(/incorrecto o ya venció/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("permite reenviar el código", async () => {
    signUp.mockResolvedValue({ error: null });
    resend.mockResolvedValue({ error: null });
    render(<SignupForm next="/" />);
    await fill();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Reenviar el código" }));
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: "ana@correo.test" }));
    expect(await screen.findByText("Te enviamos un código nuevo.")).toBeInTheDocument();
  });

  it("no envía si las contraseñas no coinciden", async () => {
    render(<SignupForm next="/" />);
    await fill({ confirm: "Otra-clave-1" });
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("no crea la cuenta sin aceptar los términos", async () => {
    render(<SignupForm next="/" />);
    await fill({ accept: false });
    expect(screen.getByText(/Acepta los términos/)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña que no mezcla mayúscula, minúscula, número y símbolo", async () => {
    render(<SignupForm next="/" />);
    await fill({ password: "clavesegura", confirm: "clavesegura" });
    expect(screen.getByText(/con mayúscula, minúscula, número y símbolo/)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("muestra los requisitos en vivo y los marca al cumplirlos", async () => {
    render(<SignupForm next="/" />);
    const requisitos = screen.getByRole("list", { name: "Requisitos de la contraseña" });
    expect(requisitos).toHaveTextContent("Un símbolo (por ejemplo ! # $ - _): falta");
    await userEvent.setup().type(screen.getByLabelText("Contraseña"), "Clave-segura1");
    expect(requisitos).toHaveTextContent("Un símbolo (por ejemplo ! # $ - _): cumple");
    expect(requisitos).not.toHaveTextContent("falta");
  });

  it("el ojo dentro de los campos muestra y oculta la contraseña, cambiando de icono", async () => {
    render(<SignupForm next="/" />);
    const user = userEvent.setup();
    const password = screen.getByLabelText("Contraseña") as HTMLInputElement;
    const confirm = screen.getByLabelText("Repite la contraseña") as HTMLInputElement;
    expect(password.type).toBe("password");
    const [primero] = screen.getAllByRole("button", { name: "Mostrar contraseña" });
    await user.click(primero!);
    expect(password.type).toBe("text");
    expect(confirm.type).toBe("text");
    expect(screen.getAllByRole("button", { name: "Ocultar contraseña" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Mostrar contraseña" })).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Ocultar contraseña" })[1]!);
    expect(password.type).toBe("password");
    expect(confirm.type).toBe("password");
  });

  it("«Sugerir contraseña segura» rellena las dos casillas con una contraseña que cumple y la muestra", async () => {
    signUp.mockResolvedValue({ error: null });
    render(<SignupForm next="/" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Sugerir contraseña segura" }));
    const password = screen.getByLabelText("Contraseña") as HTMLInputElement;
    const confirm = screen.getByLabelText("Repite la contraseña") as HTMLInputElement;
    expect(password.type).toBe("text");
    expect(password.value).toHaveLength(16);
    expect(confirm.value).toBe(password.value);
    expect(screen.getByRole("list", { name: "Requisitos de la contraseña" })).not.toHaveTextContent("falta");
    await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
    await user.type(screen.getByLabelText("Correo"), "ana@correo.test");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ password: password.value }));
  });

  it("rechaza una contraseña corta", async () => {
    render(<SignupForm next="/" />);
    await fill({ password: "corta", confirm: "corta" });
    expect(screen.getByText(/entre 8 y 72/)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("muestra un error genérico si Auth falla", async () => {
    signUp.mockResolvedValue({ error: { message: "dial tcp: lookup inbucket", code: "unexpected_failure" } });
    render(<SignupForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos crear la cuenta");
    expect(screen.getByRole("alert")).not.toHaveTextContent("inbucket");
  });

  it("si el servidor falla (5xx) lo dice sin culpar a los datos", async () => {
    signUp.mockResolvedValue({ error: { message: "dial tcp: no such host", code: "unexpected_failure", status: 500 } });
    render(<SignupForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos enviar el correo de confirmación");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Revisa tus datos");
  });

  it("con demasiados intentos pide esperar en vez de culpar a los datos", async () => {
    signUp.mockResolvedValue({ error: { message: "email rate limit exceeded", code: "over_email_send_rate_limit", status: 429 } });
    render(<SignupForm next="/" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Espera unos minutos");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Revisa tus datos");
  });

  it("si el correo ya existe en el sistema, lo dice en el campo del correo", async () => {
    signUp.mockResolvedValue({ error: { message: "User already registered", code: "user_already_exists" } });
    render(<SignupForm next="/" />);
    await fill();
    expect(await screen.findByText(/Este correo ya existe en el sistema/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/No pudimos crear la cuenta/)).toBeNull();
  });
});
