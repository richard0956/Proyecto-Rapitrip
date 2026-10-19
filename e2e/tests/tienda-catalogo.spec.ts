import { expect, test } from "@playwright/test";
import { expectNoViolations } from "../support/axe";
import { PRODUCT_ID, STORE_ID } from "../support/catalog-ids.mjs";
import { hasBackend } from "../support/backend";
import { STORE_URL } from "../support/urls";

/**
 * Catálogo y carrito de la tienda (Fase 4) sin sesión. Sin Supabase local, las lecturas las responde `support/catalog-mock.mjs`
 * (una tienda abierta con un producto de 150.00); con Supabase local se salta, porque los datos serían otros.
 */
test.describe("tienda · catálogo y carrito", () => {
  test.skip(hasBackend, "Usa el catálogo de mentira: con Supabase local los datos son distintos.");

  const pages = [
    { name: "tiendas", url: `${STORE_URL}/tiendas` },
    { name: "tienda", url: `${STORE_URL}/tiendas/${STORE_ID}` },
    { name: "producto", url: `${STORE_URL}/productos/${PRODUCT_ID}` },
    { name: "carrito vacío", url: `${STORE_URL}/carrito` },
  ];

  for (const viewport of [
    { label: "escritorio", width: 1440, height: 900 },
    { label: "móvil", width: 390, height: 844 },
  ]) {
    for (const target of pages) {
      test(`@a11y ${target.name} (${viewport.label}) no tiene violaciones WCAG 2.2 AA`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(target.url, { waitUntil: "load" });
        await expect(page.locator("h1").first()).toBeVisible();
        await expectNoViolations(page);
      });
    }
  }

  test("del catálogo al carrito: agregar, cambiar la cantidad, conservarlo al recargar y pasar a pagar pide ingresar", async ({ page }) => {
    await page.goto(`${STORE_URL}/tiendas`);
    await page.getByRole("link", { name: /Café de pruebas/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Café de pruebas" })).toBeVisible();
    await page.getByRole("link", { name: /Café molido/ }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Café molido" })).toBeVisible();

    await page.getByRole("button", { name: "Más" }).click();
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await page.goto(`${STORE_URL}/carrito`);
    await expect(page.getByRole("link", { name: "Café molido" })).toBeVisible();
    await expect(page.getByText("Total", { exact: true })).toBeVisible();
    await expectNoViolations(page);

    await page.reload();
    await expect(page.getByRole("link", { name: "Café molido" })).toBeVisible();
    await page.getByRole("button", { name: "Más" }).click();
    await expect(page.getByRole("group", { name: "Cantidad de Café molido" })).toContainText("3");

    await page.getByRole("link", { name: "Pagar" }).click();
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fcheckout/);

    await page.goto(`${STORE_URL}/carrito`);
    await page.getByRole("button", { name: /Quitar/ }).click();
    await expect(page.getByRole("link", { name: "Café molido" })).toHaveCount(0);
  });

  test("una tienda que no existe muestra la página no encontrada", async ({ page }) => {
    // Con el estado de carga (loading.tsx) la respuesta ya va en streaming: el código HTTP es 200, pero la página lleva noindex.
    await page.goto(`${STORE_URL}/tiendas/no-es-un-id`);
    await expect(page.getByRole("heading", { level: 1, name: "No encontramos esa página" })).toBeVisible();
    expect(await (await page.request.get(`${STORE_URL}/tiendas/no-es-un-id`)).text()).toContain('name="robots" content="noindex"');
  });
});
