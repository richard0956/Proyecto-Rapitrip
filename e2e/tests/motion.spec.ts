import { expect, test } from "@playwright/test";
import { CONSOLE_URL, STORE_URL } from "../support/urls";

test.describe("@motion introducción de marca y transiciones", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  for (const [name, url] of [
    ["tienda", `${STORE_URL}/`],
    ["consola", `${CONSOLE_URL}/login`],
  ] as const) {
    test(`${name}: la introducción se reproduce una vez por sesión y revela la página`, async ({ page }) => {
      await page.goto(url, { waitUntil: "commit" });
      const intro = page.locator(".intro-root");
      await expect(page.locator("html")).toHaveAttribute("data-intro", "playing");
      await expect(intro).toBeVisible();
      // Decorativa: no entra en el árbol de accesibilidad ni intercepta clics.
      await expect(intro).toHaveAttribute("aria-hidden", "true");
      expect(await intro.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");

      // Al terminar, el atributo se retira y la cortina deja de pintarse.
      await expect(page.locator("html")).toHaveAttribute("data-intro", "off", { timeout: 6000 });
      await expect(intro).toBeHidden();
      await expect(page.locator("h1").first()).toBeVisible();

      await page.reload({ waitUntil: "load" });
      await expect(page.locator("html")).not.toHaveAttribute("data-intro", "playing");
      await expect(intro).toBeHidden();
    });
  }

  test("la entrada de página deja el contenido visible y estable", async ({ page }) => {
    await page.goto(`${STORE_URL}/ingresar`, { waitUntil: "load" });
    await page.waitForTimeout(3600);
    const opacity = await page.locator(".page-enter").first().evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });
});

test.describe("@motion reducir movimiento", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("sin movimiento no hay introducción y la página aparece de inmediato", async ({ page }) => {
    await page.goto(`${STORE_URL}/`, { waitUntil: "load" });
    await expect(page.locator("html")).not.toHaveAttribute("data-intro", "playing");
    await expect(page.locator(".intro-root")).toBeHidden();
    await expect(page.locator("h1").first()).toBeVisible();
    const opacity = await page.locator(".page-enter").first().evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });
});
