import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, signInWithPassword, signOut, accountApp, createClient } = vi.hoisted(() => {
  const rpc = vi.fn();
  const signInWithPassword = vi.fn();
  const signOut = vi.fn(async () => ({ error: null }));
  // La app de la cuenta que acaba de ingresar (vista my_account_app).
  const accountApp = vi.fn(async () => ({ data: { app: "tienda" }, error: null }));
  const from = vi.fn(() => ({ select: () => ({ maybeSingle: accountApp }) }));
  return { rpc, signInWithPassword, signOut, accountApp, createClient: vi.fn(() => ({ rpc, from, auth: { signInWithPassword, signOut } })) };
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { genericLoginError } from "./login-guard";
import { passwordSignIn, passwordSignInFromForm, wrongAppMessage } from "./password-sign-in";

const input = { email: "ana@t.test", password: "Clave-123", captchaToken: "tok", clientIp: "190.1.2.3", app: "tienda" as const };
const open = { locked: false, remaining: 6, warn: false, lock_minutes: 15 };

describe("passwordSignIn", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("con la cuenta bloqueada no llama a Auth y dice cuántos minutos faltan", async () => {
    rpc.mockResolvedValueOnce({ data: { locked: true, retry_after_seconds: 601, lock_minutes: 15 }, error: null });
    const result = await passwordSignIn(input);
    expect(result).toEqual({ ok: false, reason: "locked", message: expect.stringContaining("en 11 minutos") });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("una contraseña incorrecta registra el fallo y da el mensaje genérico", async () => {
    rpc.mockResolvedValueOnce({ data: open, error: null }).mockResolvedValueOnce({ data: { ...open, remaining: 5 }, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } });
    const result = await passwordSignIn(input);
    expect(rpc).toHaveBeenLastCalledWith("login_guard_fail", { p_email: "ana@t.test" });
    expect(result).toEqual({ ok: false, reason: "invalid", message: genericLoginError });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "ana@t.test", password: "Clave-123", options: { captchaToken: "tok" } });
  });

  it("tras el 5.º fallo avisa que queda un último intento", async () => {
    rpc.mockResolvedValueOnce({ data: open, error: null }).mockResolvedValueOnce({ data: { locked: false, remaining: 1, warn: true, lock_minutes: 15 }, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials" } });
    const result = await passwordSignIn(input);
    expect(result.ok === false && result.message).toMatch(/último intento.*15 minutos/);
  });

  it("el 6.º fallo bloquea", async () => {
    rpc.mockResolvedValueOnce({ data: open, error: null }).mockResolvedValueOnce({ data: { locked: true, retry_after_seconds: 900, lock_minutes: 15 }, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "invalid_credentials" } });
    const result = await passwordSignIn(input);
    expect(result).toEqual({ ok: false, reason: "locked", message: expect.stringContaining("en 15 minutos") });
  });

  it("entrar bien reinicia el contador y devuelve la sesión", async () => {
    rpc.mockResolvedValue({ data: open, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "a", refresh_token: "r" } }, error: null });
    const result = await passwordSignIn(input);
    expect(rpc).toHaveBeenLastCalledWith("login_guard_success");
    expect(result).toEqual({ ok: true, session: { access_token: "a", refresh_token: "r" } });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("una cuenta de otra app no entra aunque la contraseña sea correcta: se cierra su sesión", async () => {
    rpc.mockResolvedValue({ data: open, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "a", refresh_token: "r" } }, error: null });
    accountApp.mockResolvedValueOnce({ data: { app: "consola" }, error: null });
    expect(await passwordSignIn(input)).toEqual({ ok: false, reason: "wrong_app", message: wrongAppMessage.tienda });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });

    accountApp.mockResolvedValueOnce({ data: { app: "tienda" }, error: null });
    expect(await passwordSignIn({ ...input, app: "consola" })).toEqual({ ok: false, reason: "wrong_app", message: wrongAppMessage.consola });
  });

  it("si no puede leer la app de la cuenta, tampoco la deja entrar", async () => {
    rpc.mockResolvedValue({ data: open, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "a", refresh_token: "r" } }, error: null });
    accountApp.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "sin permiso" } } as never);
    expect(await passwordSignIn(input)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(signOut).toHaveBeenCalled();
  });

  it("los errores que no son de contraseña no cuentan como fallo", async () => {
    rpc.mockResolvedValue({ data: open, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "email_not_confirmed" } });
    expect(await passwordSignIn(input)).toEqual({ ok: false, reason: "email_not_confirmed", message: null });
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { code: "over_request_rate_limit", status: 429 } });
    expect(await passwordSignIn(input)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(rpc).not.toHaveBeenCalledWith("login_guard_fail", expect.anything());
  });

  it("pasa la IP de quien ingresa a Auth", async () => {
    rpc.mockResolvedValue({ data: open, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "a", refresh_token: "r" } }, error: null });
    await passwordSignIn(input);
    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "anon", expect.objectContaining({ global: { headers: { "X-Forwarded-For": "190.1.2.3" } } }));
  });

  it("desde el formulario valida la entrada y toma la IP del encabezado", async () => {
    const headers = new Headers({ "x-forwarded-for": "190.1.2.3, 10.0.0.1" });
    expect(await passwordSignInFromForm({ email: "no-es-correo", password: "x" }, headers, "tienda")).toEqual({ ok: false, reason: "invalid", message: genericLoginError });
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: open, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: { access_token: "a", refresh_token: "r" } }, error: null });
    await passwordSignInFromForm({ email: " Ana@T.test ", password: "Clave-123", captchaToken: 5 }, headers, "tienda");
    expect(rpc).toHaveBeenCalledWith("login_guard_check", { p_email: "ana@t.test" });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "ana@t.test", password: "Clave-123", options: undefined });
    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "anon", expect.objectContaining({ global: { headers: { "X-Forwarded-For": "190.1.2.3" } } }));
  });

  it("si no puede consultar el límite rechaza el ingreso en vez de saltárselo", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "no existe" } });
    expect(await passwordSignIn(input)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
