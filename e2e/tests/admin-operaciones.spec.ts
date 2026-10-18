import { expect, test } from "@playwright/test";
import { backendHint, consoleClient, consoleSession, createInvitation, createSuperadmin, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { signInAndEnroll } from "../support/console";
import { openShop, orderState, placeOrder, signedInClient, stockOf } from "../support/shop";
import { CONSOLE_URL } from "../support/urls";

/** Necesita las Edge Functions sirviéndose (`supabase functions serve`): el cajero acepta su invitación con `accept-invitation`. */
test.describe("@backend administración · pedidos, excepciones y caja", () => {
  test.skip(!hasBackend, backendHint);

  test("el director revisa pedidos, excepciones y turnos de caja, y cancela un pedido con motivo", async ({ page }) => {
    test.setTimeout(240_000);
    const unique = Date.now();
    const shop = await openShop("Comercio de administración", { store: `Tienda ${unique}`, product: `Café ${unique}` });
    const client = await signedInClient();
    const first = await placeOrder(client, shop.storeId, shop.variantId, 1, "efectivo");
    const second = await placeOrder(client, shop.storeId, shop.variantId, 1, "efectivo");
    const numberOf = async (id: string) => String((await client.from("orders_list").select("number").eq("id", id).single()).data!.number);
    const [n1, n2] = [await numberOf(first), await numberOf(second)];
    for (const to of ["confirmado", "preparando", "listo"]) {
      const { error } = await shop.owner.rpc("set_order_status", { p_order: first, p_to: to });
      expect(error).toBeNull();
    }
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);

    // Un cajero con un turno cerrado con diferencia (todo por API; la invitación se acepta con la función de borde).
    const setup = await createSuperadmin();
    const api = await consoleClient(setup.email, setup.password);
    const cashierEmail = uniqueEmail("cajero");
    const token = await createInvitation(api, cashierEmail, "cajero");
    const accepted = await fetch(`${process.env.SUPABASE_URL}/functions/v1/accept-invitation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password: PASSWORD, full_name: "Cajera Administrada" }),
    });
    expect(accepted.status).toBe(200);
    const { client: cashier } = await consoleSession(cashierEmail, PASSWORD);
    expect((await cashier.rpc("open_cash_session", { p_opening: 500 })).error).toBeNull();
    const sale = await cashier.rpc("create_counter_sale", { p_store: shop.storeId, p_items: [{ variant_id: shop.variantId, quantity: 1 }], p_payment_method: "efectivo" });
    expect(sale.error).toBeNull();
    const { data: saleRow } = await cashier.from("orders_list").select("number").eq("id", sale.data as string).single();
    const closed = await cashier.rpc("close_cash_session", { p_counted: 640, p_note: "faltan 10 de un vuelto" });
    expect(closed.error).toBeNull();

    // El director entra por la interfaz (otra cuenta: la anterior ya enroló su segundo factor por API).
    const director = await createSuperadmin();
    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });

    // Pedidos: filtros, detalle y cancelación
    await page.goto(`${CONSOLE_URL}/admin/pedidos`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pedidos", { timeout: 30_000 });
    await page.getByLabel("Buscar").fill(`Tienda ${unique}`);
    await expect(page.getByRole("button", { name: new RegExp(`Pedido ${n1}(?!\\d)`) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`Venta ${saleRow!.number}(?!\\d)`) })).toBeVisible();
    await page.getByLabel("Estado").selectOption("listo");
    await expect(page.getByRole("button", { name: new RegExp(`Pedido ${n1}(?!\\d)`) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`Pedido ${n2}(?!\\d)`) })).toHaveCount(0);
    await page.getByLabel("Estado").selectOption("");
    await page.getByLabel("Canal").selectOption("mostrador");
    await expect(page.getByRole("button", { name: new RegExp(`Venta ${saleRow!.number}(?!\\d)`) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`Pedido ${n1}(?!\\d)`) })).toHaveCount(0);
    await page.getByLabel("Canal").selectOption("");
    await expectNoViolations(page);

    await page.getByRole("button", { name: new RegExp(`Pedido ${n1}(?!\\d)`) }).click();
    await expect(page.getByText("Barrio Central, casa 4", { exact: true })).toBeVisible();
    await expect(page.getByText("Sin asignar")).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`Pedido ${n2}(?!\\d)`) }).click();
    await page.getByRole("button", { name: "Cancelar pedido", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Cancelar pedido" })).toBeDisabled();
    await dialog.getByLabel("Motivo").fill("el cliente pidió cancelar por teléfono");
    await dialog.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect.poll(() => orderState(client, second), { timeout: 15_000 }).toBe("cancelado/pendiente");
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);

    // Excepciones: el pedido listo sin repartidor aparece y lleva al detalle
    await page.goto(`${CONSOLE_URL}/admin/excepciones`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Excepciones", { timeout: 30_000 });
    await expect(page.getByText("Listos sin repartidor")).toBeVisible();
    await expectNoViolations(page);
    await page.locator(`a[href="/admin/pedidos?pedido=${n1}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/admin/pedidos\\?pedido=${n1}$`));
    await expect(page.getByRole("heading", { name: `Pedido ${n1}` })).toBeVisible({ timeout: 30_000 });

    // Caja: el turno con diferencia
    await page.goto(`${CONSOLE_URL}/admin/caja?diferencia=1`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Caja y venta", { timeout: 30_000 });
    const shift = page.locator("details", { hasText: "Cajera Administrada" }).first();
    await expect(shift).toBeVisible();
    await expect(shift.getByText(/Diferencia.*10/)).toBeVisible();
    await shift.locator("summary").click();
    await expect(shift.getByText("Nota del cajero: faltan 10 de un vuelto")).toBeVisible();
    await expect(shift.getByText(new RegExp(`Venta ${saleRow!.number}(?!\\d)`))).toBeVisible();
    await expectNoViolations(page);
  });
});
