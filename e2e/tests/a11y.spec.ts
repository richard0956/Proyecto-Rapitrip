import { expect, test } from "@playwright/test";
import { expectNoViolations } from "../support/axe";
import { CONSOLE_URL, STORE_URL } from "../support/urls";

/** Pantallas públicas (no necesitan sesión ni backend). Las autenticadas se revisan en los flujos con backend. */
const pages = [
  { name: "consola · ingresar", url: `${CONSOLE_URL}/login` },
  { name: "consola · invitación con enlace inválido", url: `${CONSOLE_URL}/aceptar-invitacion` },
  { name: "consola · invitación con enlace válido", url: `${CONSOLE_URL}/aceptar-invitacion?token=${"a".repeat(43)}` },
  { name: "consola · cuenta sin acceso", url: `${CONSOLE_URL}/sin-acceso` },
  { name: "consola · sesión expirada", url: `${CONSOLE_URL}/sesion-expirada` },
  { name: "tienda · inicio", url: `${STORE_URL}/` },
  { name: "tienda · ingresar", url: `${STORE_URL}/ingresar` },
  { name: "tienda · ingresar con sesión vencida", url: `${STORE_URL}/ingresar?next=/vende&expirada=1` },
  { name: "tienda · crear cuenta", url: `${STORE_URL}/registro` },
  { name: "tienda · recuperar contraseña", url: `${STORE_URL}/recuperar` },
  { name: "tienda · página no encontrada", url: `${STORE_URL}/no-existe` },
];

const viewports = [
  { label: "escritorio", width: 1440, height: 900 },
  { label: "móvil", width: 390, height: 844 },
];

for (const viewport of viewports) {
  for (const target of pages) {
    test(`@a11y ${target.name} (${viewport.label}) no tiene violaciones WCAG 2.2 AA`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(target.url, { waitUntil: "load" });
      await expect(page.locator("h1").first()).toBeVisible();
      await expectNoViolations(page);
    });
  }
}

test("@a11y la consola y la tienda declaran el idioma y un título por página", async ({ page }) => {
  for (const url of [`${CONSOLE_URL}/login`, `${STORE_URL}/`]) {
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    expect((await page.title()).length).toBeGreaterThan(3);
  }
});
