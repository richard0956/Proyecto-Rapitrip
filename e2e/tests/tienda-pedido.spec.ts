import { expect, test } from "@playwright/test";
import { backendHint, createUser, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { openShop, stockOf } from "../support/shop";
import { STORE_URL } from "../support/urls";

/**
 * Compra real en la tienda (Fase 4), con Supabase local: carrito → ingresar → checkout en efectivo → pedido → cancelación.
 * El pago con tarjeta (Stripe) se prueba aparte en `pagos.spec.ts`, porque necesita claves de prueba propias.
 */
test.describe("@backend tienda · pedido del cliente", () => {
  test.skip(!hasBackend, backendHint);

  test("el cliente compra en efectivo, ve su pedido y lo cancela; el stock vuelve", async ({ page, context }) => {
    test.setTimeout(180_000);
    const shop = await openShop("Comercio de la tienda", { store: `Tienda ${Date.now()}` });
    const email = uniqueEmail("comprador");
    await createUser(email, { fullName: "Ana Compradora" });

    // El carrito vive en el navegador: se deja armado como lo dejaría «Agregar al carrito». El script corre en cada carga de
    // página, así que se siembra una sola vez por pestaña (sessionStorage); si no, volvería a aparecer después de confirmar.
    await page.addInitScript(
      ([key, cart]) => {
        if (sessionStorage.getItem("e2e-cart-seeded")) return;
        sessionStorage.setItem("e2e-cart-seeded", "1");
        localStorage.setItem(key, cart);
      },
      ["rapitrip-cart-v2", JSON.stringify({ lines: [{ storeId: shop.storeId, storeName: "Tienda", variantId: shop.variantId, quantity: 2, seenPrice: 150 }] })] as const,
    );

    await page.goto(`${STORE_URL}/checkout`);
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fcheckout/);
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoViolations(page);

    await page.getByLabel("Dirección de entrega").fill("Barrio Central, casa 4, portón azul");
    await page.getByLabel("Teléfono de contacto").fill("88881111");
    // Sin el pin del destino no se puede confirmar; con él, la base de datos cotiza el envío: a 0 km y sin otro departamento es express (zona 1, C$50).
    await expect(page.getByRole("button", { name: "Marca tu punto de entrega" })).toBeDisabled();
    await context.grantPermissions(["geolocation"], { origin: STORE_URL });
    await context.setGeolocation({ latitude: 12.1364, longitude: -86.2514 });
    await page.getByRole("button", { name: "Usar mi ubicación" }).click();
    await expect(page.getByText("Llega en pocas horas")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("radio", { name: /Efectivo contra entrega/ }).check();
    await page.getByRole("button", { name: "Confirmar pedido" }).click();

    await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: /^Pedido \d+/ })).toBeVisible();
    await expect(page.getByText("Barrio Central, casa 4, portón azul")).toBeVisible();
    // 2 × 150 + 50 de envío de la zona 1.
    await expect(page.getByText("350,00 NIO")).toBeVisible();
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);
    await expectNoViolations(page);

    // El carrito se vació al confirmar.
    await page.goto(`${STORE_URL}/carrito`);
    await expect(page.getByText(/carrito está vacío/i)).toBeVisible();

    await page.goto(`${STORE_URL}/pedidos`);
    await page.getByRole("link", { name: /Pedido \d+/ }).first().click();
    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await page.getByLabel("Motivo de la cancelación").fill("Me equivoqué de tienda");
    await page.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect.poll(() => stockOf(shop.owner, shop.variantId), { timeout: 20_000 }).toBe(10);
  });
});
