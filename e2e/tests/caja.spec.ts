import { expect, test } from "@playwright/test";
import { backendHint, consoleClient, createInvitation, createSuperadmin, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { signInAndEnroll } from "../support/console";
import { openShop, stockOf } from "../support/shop";
import { CONSOLE_URL } from "../support/urls";

/** Necesita las Edge Functions sirviéndose (`supabase functions serve`): el cajero acepta su invitación con `accept-invitation`. */
test.describe("@backend caja · turno y venta de mostrador", () => {
  test.skip(!hasBackend, backendHint);

  test("el cajero abre su turno, vende, anula una venta y cierra la caja con diferencia", async ({ page }) => {
    test.setTimeout(240_000);
    const unique = Date.now();
    const product = `Café ${unique}`;
    const shop = await openShop("Comercio de caja", { store: `Tienda ${unique}`, product });

    // El director invita al cajero; el cajero acepta, enrola el segundo factor y entra a /caja.
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
    await signInAndEnroll(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/caja$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Caja y venta");

    // Abrir turno con 500.00
    await expect(page.getByText("No hay un turno abierto")).toBeVisible();
    await expectNoViolations(page);
    await page.getByLabel("Efectivo inicial en caja").fill("500");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(page.getByText("Turno abierto", { exact: true })).toBeVisible({ timeout: 30_000 });

    // Con varias tiendas en la base local, se elige la de esta prueba.
    const storeTab = page.getByRole("tab", { name: `Tienda ${unique}` });
    if (await storeTab.count()) await storeTab.click();

    // Venta en efectivo: 2 cafés (300.00) con vuelto
    await page.getByLabel("Buscar producto").fill(product);
    const add = page.getByRole("button", { name: `Agregar ${product}, 500 g` });
    await add.click();
    await add.click();
    await expect(page.getByLabel(`Cantidad de ${product}, 500 g`)).toHaveText("2");
    await page.getByLabel("Efectivo recibido").fill("500");
    await expect(page.getByText(/Vuelto:.*200/)).toBeVisible();
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Cobrar" }).click();
    await expect(page.getByText(/Venta registrada por.*300/)).toBeVisible();
    await expect(page.getByText(/Ventas \(1\)/)).toBeVisible();
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);

    // Venta con tarjeta en terminal: 1 café; luego se anula
    await add.click();
    await page.getByRole("tab", { name: "Tarjeta (terminal)" }).click();
    await page.getByRole("button", { name: "Cobrar" }).click();
    await expect(page.getByText(/Ventas \(2\)/)).toBeVisible();
    expect(await stockOf(shop.owner, shop.variantId)).toBe(7);
    await page.getByRole("button", { name: /Anular la venta/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Anular venta" })).toBeDisabled();
    await dialog.getByLabel("Motivo").fill("el cliente se arrepintió");
    await dialog.getByRole("button", { name: "Anular venta" }).click();
    await expect(page.getByText("Anulada")).toBeVisible();
    await expect(page.getByText(/Ventas \(1\)/)).toBeVisible();
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);

    // Cierre: se esperan 500 + 300 = 800; con 790 hay diferencia y exige nota
    await expect(page.getByText(/Efectivo esperado/).locator("..")).toContainText("800");
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    const close = page.getByRole("dialog");
    await close.getByLabel("Efectivo contado").fill("790");
    await close.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(close.getByRole("alert")).toContainText("diferencia");
    await close.getByLabel("Nota").fill("faltan 10 de un vuelto mal dado");
    await close.getByRole("button", { name: "Cerrar caja" }).click();

    await expect(page.getByText("No hay un turno abierto")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Diferencia.*10/)).toBeVisible();
    await expectNoViolations(page);
  });
});
