import { expect, type Page } from "@playwright/test";
import { totp } from "./backend";
import { CONSOLE_URL } from "./urls";

export async function fillCode(page: Page, code: string) {
  await page.getByLabel(/dígito 1 de 6/).click();
  await page.keyboard.type(code);
  await page.getByRole("button", { name: "Verificar y continuar" }).click();
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${CONSOLE_URL}/login`);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar a la consola" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
}

/** Primer ingreso: contraseña, alta del segundo factor leyendo la clave manual y verificación. Devuelve el secreto. */
export async function signInAndEnroll(page: Page, email: string, password: string): Promise<string> {
  await signIn(page, email, password);
  const secret = (await page.locator("code").first().textContent())?.trim();
  if (!secret) throw new Error("La pantalla de alta no mostró la clave manual");
  await fillCode(page, totp(secret));
  return secret;
}
