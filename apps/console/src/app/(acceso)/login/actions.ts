"use server";

import { passwordSignInFromForm, type PasswordSignInResult } from "@rapitrip/supabase/password-sign-in";
import { headers } from "next/headers";

/** El ingreso con contraseña pasa por el servidor para aplicar el límite de intentos fallidos. */
export async function signInWithPasswordAction(email: string, password: string, captchaToken: string | null): Promise<PasswordSignInResult> {
  return passwordSignInFromForm({ email, password, captchaToken }, await headers());
}
