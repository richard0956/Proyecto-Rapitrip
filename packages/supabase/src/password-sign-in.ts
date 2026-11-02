import { createClient } from "@supabase/supabase-js";
import { emailSchema } from "@rapitrip/validation";
import { publicEnv } from "./env";
import { failedLoginMessage, genericLoginError, lockedLoginMessage, type LoginGuardState } from "./login-guard";

/**
 * Ingreso con contraseña del lado del servidor, con el límite de intentos fallidos (ver `private.login_lock_policy`).
 * Solo para server actions. Devuelve los tokens de la sesión; el navegador los guarda con `auth.setSession`
 * para que su cliente (cookie propia de cada app, eventos de sesión) siga igual que antes.
 */
export type PasswordSignInResult =
  | { ok: true; session: { access_token: string; refresh_token: string } }
  | { ok: false; reason: "invalid" | "locked" | "email_not_confirmed" | "captcha" | "unavailable"; message: string | null };

type Input = { email: string; password: string; captchaToken?: string | null; clientIp?: string | null };

const unavailable: PasswordSignInResult = { ok: false, reason: "unavailable", message: "No pudimos iniciar sesión. Inténtalo de nuevo en un momento." };

export async function passwordSignIn({ email, password, captchaToken, clientIp }: Input): Promise<PasswordSignInResult> {
  const { url, anonKey } = publicEnv();
  // Cliente de un solo uso, sin guardar nada. La IP de quien ingresa viaja a Auth para que su límite por IP
  // no junte a todos bajo la del servidor.
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(clientIp ? { global: { headers: { "X-Forwarded-For": clientIp } } } : {}),
  });

  const { data: check, error: checkError } = await supabase.rpc("login_guard_check", { p_email: email });
  if (checkError) {
    // Sin poder consultar el límite se rechaza el ingreso en vez de saltárselo.
    console.error("[ingreso] login_guard_check", checkError.code, checkError.message);
    return unavailable;
  }
  const state = check as LoginGuardState;
  // Bloqueada: ni siquiera se consulta a Auth.
  if (state.locked) return { ok: false, reason: "locked", message: lockedLoginMessage(state.retry_after_seconds) };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: captchaToken ? { captchaToken } : undefined });

  if (error) {
    if (error.code === "invalid_credentials") {
      const { data: after, error: failError } = await supabase.rpc("login_guard_fail", { p_email: email });
      if (failError) console.error("[ingreso] login_guard_fail", failError.code, failError.message);
      const next = after as LoginGuardState | null;
      return { ok: false, reason: next?.locked ? "locked" : "invalid", message: next ? failedLoginMessage(next) : genericLoginError };
    }
    if (error.code === "email_not_confirmed") return { ok: false, reason: "email_not_confirmed", message: null };
    if (error.code === "captcha_failed") return { ok: false, reason: "captcha", message: genericLoginError };
    console.error("[ingreso] signInWithPassword", error.status, error.code, error.message);
    return unavailable;
  }
  if (!data.session) return unavailable;

  // Ya con la sesión abierta: la base solo deja limpiar el contador del propio correo.
  const { error: clearError } = await supabase.rpc("login_guard_success");
  if (clearError) console.error("[ingreso] login_guard_success", clearError.code, clearError.message);
  return { ok: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } };
}

/** Entrada de las server actions de login: lo que manda el navegador no es confiable, así que se valida aquí. */
export async function passwordSignInFromForm(
  raw: { email: unknown; password: unknown; captchaToken?: unknown },
  requestHeaders: { get(name: string): string | null },
): Promise<PasswordSignInResult> {
  const email = emailSchema.safeParse(raw.email);
  const password = typeof raw.password === "string" && raw.password.length > 0 && raw.password.length <= 1024 ? raw.password : null;
  if (!email.success || !password) return { ok: false, reason: "invalid", message: genericLoginError };
  const captchaToken = typeof raw.captchaToken === "string" && raw.captchaToken.length <= 4096 ? raw.captchaToken : null;
  // La plataforma de hosting fija el primer valor de x-forwarded-for con la IP real de quien ingresa.
  const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;
  return passwordSignIn({ email: email.data, password, captchaToken, clientIp });
}
