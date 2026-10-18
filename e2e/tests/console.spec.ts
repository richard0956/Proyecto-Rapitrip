import { expect, test } from "@playwright/test";
import { backendHint, consoleClient, createInvitation, createSuperadmin, createUser, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { alertOf } from "../support/locators";
import { signIn, signInAndEnroll } from "../support/console";
import { CONSOLE_URL } from "../support/urls";

test.describe("@backend consola · acceso y roles", () => {
  test.skip(!hasBackend, backendHint);

  test("sin sesión, las rutas protegidas llevan a /login", async ({ page }) => {
    for (const path of ["/admin", "/admin/usuarios", "/caja", "/coordinacion", "/comercio", "/cuenta"]) {
      await page.goto(`${CONSOLE_URL}${path}`);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("una contraseña incorrecta muestra un error genérico", async ({ page }) => {
    const director = await createSuperadmin();
    await page.goto(`${CONSOLE_URL}/login`);
    await page.getByLabel("Correo").fill(director.email);
    await page.getByLabel("Contraseña").fill("no-es-la-clave");
    await page.getByRole("button", { name: "Ingresar a la consola" }).click();
    await expect(alertOf(page)).toContainText("No pudimos iniciar sesión");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("un código MFA incorrecto no deja pasar", async ({ page }) => {
    const director = await createSuperadmin();
    await signIn(page, director.email, director.password);
    await page.getByLabel(/dígito 1 de 6/).click();
    await page.keyboard.type("000000");
    await page.getByRole("button", { name: "Verificar y continuar" }).click();
    await expect(alertOf(page)).toContainText("El código no es válido");
    await expect(page).toHaveURL(/\/mfa$/);
  });

  test("el director ingresa, enrola el segundo factor y recorre la administración sin violaciones de accesibilidad", async ({ page }) => {
    // Recorre diez pantallas con axe; en `next dev` la primera visita de cada ruta compila.
    test.setTimeout(180_000);
    const director = await createSuperadmin();
    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola");

    for (const path of ["/admin", "/admin/usuarios", "/admin/solicitudes", "/admin/comercios", "/admin/repartidores", "/admin/auditoria", "/admin/accesos", "/admin/incidentes", "/admin/datos-personales", "/cuenta"]) {
      await page.goto(`${CONSOLE_URL}${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoViolations(page);
    }
  });

  test("invitación: se acepta, se enrola el segundo factor y el encargado llega a operaciones sin poder entrar a administración", async ({ page }) => {
    const director = await createSuperadmin();
    const api = await consoleClient(director.email, director.password);
    const email = uniqueEmail("cajero");
    const token = await createInvitation(api, email, "cajero");

    await page.goto(`${CONSOLE_URL}/aceptar-invitacion?token=${token}`);
    await page.getByLabel("Nombre completo").fill("Caja de Prueba");
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Repite la contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear acceso" }).click();
    await expect(page).toHaveURL(/\/login\?invitacion=ok$/);
    await expect(page.getByRole("status").first()).toContainText("Tu acceso está listo");

    await signInAndEnroll(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/caja$/);

    await page.goto(`${CONSOLE_URL}/admin`);
    await expect(page).toHaveURL(/\/sin-acceso$/);
  });

  test("un enlace de invitación usado deja de servir", async ({ page }) => {
    const director = await createSuperadmin();
    const api = await consoleClient(director.email, director.password);
    const token = await createInvitation(api, uniqueEmail("coord"), "coordinador");

    for (const intento of [1, 2]) {
      await page.goto(`${CONSOLE_URL}/aceptar-invitacion?token=${token}`);
      await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
      await page.getByLabel("Repite la contraseña").fill(PASSWORD);
      await page.getByRole("button", { name: "Crear acceso" }).click();
      if (intento === 1) await expect(page).toHaveURL(/\/login\?invitacion=ok$/);
      else await expect(alertOf(page)).toContainText("no es válida o ya venció");
    }
  });

  test("una cuenta de cliente no tiene acceso a la consola", async ({ page }) => {
    const email = uniqueEmail("cliente");
    await createUser(email);
    await page.goto(`${CONSOLE_URL}/login`);
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar a la consola" }).click();
    await expect(page).toHaveURL(/\/sin-acceso$/);
  });

  test("la sesión se cierra tras 15 minutos sin actividad", async ({ page }) => {
    const director = await createSuperadmin();
    await page.clock.install({ time: new Date() });
    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/);
    await page.clock.fastForward("16:00");
    await expect(page).toHaveURL(/\/sesion-expirada$/);
    await page.goto(`${CONSOLE_URL}/admin`);
    await expect(page).toHaveURL(/\/login$/);
  });
});
