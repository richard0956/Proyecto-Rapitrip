import { expect, test } from "@playwright/test";
import { expectNoViolations } from "../support/axe";
import { PRODUCT_ID, STORE2_ID, STORE_ID } from "../support/catalog-ids.mjs";
import { hasBackend } from "../support/backend";
import { STORE_URL } from "../support/urls";

/**
 * Catálogo y carrito de la tienda (Fase 4) sin sesión. Sin Supabase local, las lecturas las responde `support/catalog-mock.mjs`
 * (una tienda abierta con un producto de 150.00); con Supabase local se salta, porque los datos serían otros.
 */
test.describe("tienda · catálogo y carrito", () => {
  test.skip(hasBackend, "Usa el catálogo de mentira: con Supabase local los datos son distintos.");

  const pages = [
    { name: "catálogo", url: `${STORE_URL}/catalogo` },
    { name: "catálogo filtrado", url: `${STORE_URL}/catalogo?q=caf&min=50&tipo=informal&orden=precio_desc` },
    { name: "catálogo sin resultados", url: `${STORE_URL}/catalogo?q=zzzz` },
    { name: "tiendas", url: `${STORE_URL}/tiendas` },
    { name: "tiendas filtradas", url: `${STORE_URL}/tiendas?tipo=empresa` },
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

  test.describe("catálogo con filtros", () => {
    const cards = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Resultados" }).getByRole("heading", { level: 3 });

    test("muestra todos los productos con tarjetas, total y filtros", async ({ page }) => {
      await page.goto(`${STORE_URL}/catalogo`);
      await expect(page.getByRole("heading", { level: 1, name: "Catálogo" })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "8 productos" })).toBeVisible();
      await expect(cards(page)).toHaveCount(8);
      await expect(page.getByRole("search", { name: "Filtros del catálogo" })).toBeVisible();
    });

    test("filtra por categoría y conserva el resto de filtros en la dirección", async ({ page }) => {
      await page.goto(`${STORE_URL}/catalogo?orden=precio_asc`);
      await page.getByRole("navigation", { name: "Categorías" }).getByRole("link", { name: /Abarrotes/ }).click();
      await expect(page).toHaveURL(/categoria=.*orden=precio_asc|orden=precio_asc.*categoria=/);
      await expect(cards(page)).toHaveCount(4);
      await expect(cards(page).first()).toHaveText("Arroz blanco");
      await page.getByRole("link", { name: "Quitar filtro Abarrotes" }).click();
      await expect(cards(page)).toHaveCount(8);
    });

    test("busca por nombre y filtra por rango de precio", async ({ page }) => {
      await page.goto(`${STORE_URL}/catalogo`);
      await page.getByLabel("Buscar", { exact: true }).fill("arroz");
      await page.getByRole("button", { name: "Aplicar filtros" }).click();
      await expect(page.getByRole("status").filter({ hasText: "1 producto" })).toBeVisible();

      await page.goto(`${STORE_URL}/catalogo`);
      await page.getByLabel("Precio mínimo").fill("100");
      await page.getByLabel("Precio máximo").fill("200");
      await page.getByRole("button", { name: "Aplicar filtros" }).click();
      await expect(cards(page)).toHaveText(["Café en grano", "Café instantáneo", "Café molido"]);
    });

    test("filtra por tipo de vendedor y por tienda", async ({ page }) => {
      await page.goto(`${STORE_URL}/catalogo`);
      await page.getByRole("radio", { name: "Empresa" }).check();
      await page.getByRole("button", { name: "Aplicar filtros" }).click();
      await expect(cards(page)).toHaveCount(5);

      await page.goto(`${STORE_URL}/catalogo`);
      await page.getByLabel("Tienda", { exact: true }).selectOption(STORE_ID);
      await page.getByRole("button", { name: "Aplicar filtros" }).click();
      await expect(cards(page)).toHaveCount(3);
    });

    test("ordena por precio", async ({ page }) => {
      await page.goto(`${STORE_URL}/catalogo`);
      await page.getByLabel("Ordenar por").selectOption("precio_desc");
      await expect(page).toHaveURL(/orden=precio_desc/);
      await expect(cards(page).first()).toHaveText("Café instantáneo");
    });

    test("sin resultados ofrece volver al catálogo completo", async ({ page }) => {
      await page.goto(`${STORE_URL}/catalogo?q=zzzz`);
      await expect(page.getByText("No encontramos productos con esos filtros")).toBeVisible();
      await page.getByRole("link", { name: "Ver todo el catálogo" }).click();
      await expect(cards(page)).toHaveCount(8);
    });

    test("el botón redondo agrega al carrito; con varias presentaciones lleva a la ficha", async ({ page }) => {
      await page.goto(`${STORE_URL}/catalogo`);
      await page.getByRole("button", { name: "Agregar Capuchino al carrito" }).click();
      await expect(page.getByRole("link", { name: /Carrito, 1 producto/ })).toBeVisible();
      // «Café en grano» tiene dos presentaciones: no hay botón rápido, solo la tarjeta que abre la ficha.
      await expect(page.getByRole("button", { name: "Agregar Café en grano al carrito" })).toHaveCount(0);
      await page.getByRole("link", { name: "Café en grano" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Café en grano" })).toBeVisible();
    });

    test("de otra tienda: avisa antes de vaciar el carrito", async ({ page }) => {
      await page.goto(`${STORE_URL}/tiendas/${STORE2_ID}`);
      await page.getByRole("button", { name: "Agregar Frijoles rojos al carrito" }).click();
      await page.goto(`${STORE_URL}/catalogo`);
      await page.getByRole("button", { name: "Agregar Capuchino al carrito" }).click();
      await expect(page.getByRole("dialog", { name: "Tu carrito es de otra tienda" })).toBeVisible();
    });

    test("@a11y en móvil el panel de filtros se abre con su botón", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${STORE_URL}/catalogo`);
      const toggle = page.getByRole("button", { name: /^Filtros/ });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByLabel("Precio mínimo")).toBeVisible();
      await expectNoViolations(page);
    });
  });

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
