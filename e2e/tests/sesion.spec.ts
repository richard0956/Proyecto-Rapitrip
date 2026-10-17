import { expect, test, type BrowserContext } from "@playwright/test";
import { backendHint, createSuperadmin, createUser, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
import { alertOf } from "../support/locators";
import { signInAndEnroll } from "../support/console";
import { CONSOLE_URL, STORE_URL } from "../support/urls";

/** Lee el JWT de acceso de la cookie de sesión de la consola (@supabase/ssr la guarda en JSON base64, a veces en trozos). */
async function consoleToken(context: BrowserContext) {
  const parts = (await context.cookies()).filter((c) => c.name.startsWith("rapitrip-console-auth")).sort((a, b) => a.name.localeCompare(b.name));
  const raw = parts.map((c) => decodeURIComponent(c.value)).join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString() : raw;
  const session = JSON.parse(json) as { access_token: string };
  const payload = JSON.parse(Buffer.from(session.access_token.split(".")[1]!, "base64url").toString()) as { aal: string; iat: number };
  return { aal: payload.aal, iat: payload.iat };
}

/** Verificaciones de la lista manual de la Fase 1 que se pueden automatizar (docs/fase-1-puesta-en-marcha.md, sección 6). */
test.describe("@backend sesión · renovación del token y sesiones simultáneas", () => {
  test.skip(!hasBackend, backendHint);

  test("al renovarse el token con actividad, la sesión de consola se mantiene en aal2", async ({ page, context }) => {
    // El token dura 5 minutos (`jwt_expiry = 300`): con el reloj adelantado 20 minutos se renueva varias veces.
    test.setTimeout(180_000);
    const director = await createSuperadmin();
    await page.clock.install({ time: new Date() });
    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
    const before = await consoleToken(context);
    expect(before.aal).toBe("aal2");

    for (let step = 0; step < 40; step++) {
      await page.keyboard.press("Shift"); // actividad real: el cierre por inactividad se mide desde la última interacción
      await page.clock.fastForward("00:30");
    }
    await page.waitForTimeout(1_500);

    // Una lectura que exige sesión fuerte (contraseña + segundo factor + actividad) sigue funcionando.
    await page.goto(`${CONSOLE_URL}/admin/auditoria`);
    await expect(page).toHaveURL(/\/admin\/auditoria/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(alertOf(page)).toHaveCount(0);
    await page.goto(`${CONSOLE_URL}/admin/usuarios`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(alertOf(page)).toHaveCount(0);

    // Y el token vigente es uno nuevo (se renovó) que sigue declarando aal2.
    const after = await consoleToken(context);
    expect(after.iat).toBeGreaterThan(before.iat);
    expect(after.aal).toBe("aal2");
  });

  test("consola y tienda pueden tener sesión a la vez en el mismo navegador sin cerrarse entre sí", async ({ context }) => {
    const director = await createSuperadmin();
    const customerEmail = uniqueEmail("cliente");
    await createUser(customerEmail, { fullName: "Cliente Simultáneo" });

    const store = await context.newPage();
    await store.goto(`${STORE_URL}/ingresar`);
    await store.getByLabel("Correo").fill(customerEmail);
    await store.getByLabel("Contraseña").fill(PASSWORD);
    await store.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(store).toHaveURL(`${STORE_URL}/`, { timeout: 30_000 });

    const console_ = await context.newPage();
    await signInAndEnroll(console_, director.email, director.password);
    await expect(console_).toHaveURL(/\/admin$/, { timeout: 30_000 });

    // Recargar una no afecta a la otra: cada app usa su propia cookie de sesión.
    await store.goto(`${STORE_URL}/perfil`);
    await expect(store.getByRole("heading", { level: 1 })).toHaveText("Mi perfil");
    await console_.goto(`${CONSOLE_URL}/admin/usuarios`);
    await expect(console_.getByRole("heading", { level: 1 })).toBeVisible();
    await store.goto(`${STORE_URL}/perfil`);
    await expect(store).toHaveURL(/\/perfil$/);

    const cookies = (await context.cookies()).map((c) => c.name);
    expect(cookies.some((name) => name.startsWith("rapitrip-store-auth"))).toBe(true);
    expect(cookies.some((name) => name.startsWith("rapitrip-console-auth"))).toBe(true);
  });
});
