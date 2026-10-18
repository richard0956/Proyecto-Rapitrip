import { expect, test } from "@playwright/test";
import { backendHint, consoleClient, createInvitation, createSuperadmin, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { signInAndEnroll } from "../support/console";
import { openShop, orderState, placeOrder, signedInClient, stockOf } from "../support/shop";
import { CONSOLE_URL } from "../support/urls";

/** Necesita las Edge Functions sirviéndose (`supabase functions serve`): el coordinador acepta su invitación con `accept-invitation`. */
test.describe("@backend coordinación · despacho y entrega", () => {
  test.skip(!hasBackend, backendHint);

  test("coordinación asigna repartidor, despacha y entrega un pedido, y cancela otro con motivo", async ({ page }) => {
    test.setTimeout(240_000);
    const unique = Date.now();
    const shop = await openShop("Comercio de despacho", { store: `Tienda ${unique}`, product: `Café ${unique}` });
    const client = await signedInClient();
    const first = await placeOrder(client, shop.storeId, shop.variantId, 1, "efectivo");
    const second = await placeOrder(client, shop.storeId, shop.variantId, 1, "efectivo");
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);
    const numberOf = async (id: string) => String((await client.from("orders_list").select("number").eq("id", id).single()).data!.number);
    const [n1, n2] = [await numberOf(first), await numberOf(second)];

    // El comercio deja el primero listo y el segundo en preparación.
    for (const to of ["confirmado", "preparando", "listo"]) {
      const { error } = await shop.owner.rpc("set_order_status", { p_order: first, p_to: to });
      expect(error).toBeNull();
    }
    for (const to of ["confirmado", "preparando"]) {
      const { error } = await shop.owner.rpc("set_order_status", { p_order: second, p_to: to });
      expect(error).toBeNull();
    }

    // El director da de alta un repartidor y a la persona de coordinación.
    const director = await createSuperadmin();
    const api = await consoleClient(director.email, director.password);
    const courierName = `Repartidor ${unique}`;
    const { error: courierError } = await api.rpc("create_courier", { p_full_name: courierName, p_phone: "88880000", p_vehicle_type: "moto" });
    expect(courierError).toBeNull();
    const email = uniqueEmail("coordinador");
    const token = await createInvitation(api, email, "coordinador");
    await page.goto(`${CONSOLE_URL}/aceptar-invitacion?token=${token}`);
    await page.getByLabel("Nombre completo").fill("Coordinación de Prueba");
    await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Repite la contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear acceso" }).click();
    await expect(page).toHaveURL(/\/login\?invitacion=ok$/);
    await signInAndEnroll(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/coordinacion$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pedidos");
    await expect(page.getByRole("tab", { name: /Para despachar\s*\d+/ })).toBeVisible();
    await expectNoViolations(page);

    // Asignar repartidor → despachar → entregar
    await page.getByRole("button", { name: new RegExp(`Pedido ${n1}(?!\\d)`) }).click();
    await expect(page.getByText("Barrio Central, casa 4", { exact: true })).toBeVisible();
    await expect(page.getByText("88881111", { exact: true })).toBeVisible();
    await expect(page.getByText(/El repartidor cobra.*en efectivo/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Despachar", exact: true })).toBeDisabled();
    await expect(page.getByText("Asigna un repartidor para poder despachar.")).toBeVisible();
    await page.getByLabel("Repartidor").selectOption({ label: `${courierName} · moto` });
    await page.getByRole("button", { name: "Asignar repartidor" }).click();
    await expect(page.getByText("Repartidor asignado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Despachar", exact: true })).toBeEnabled();
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Despachar", exact: true }).click();
    await expect(page.getByText(`Pedido ${n1}: en camino.`)).toBeVisible();
    await expect(page.getByRole("tab", { name: /En camino/, selected: true })).toBeVisible();
    await page.getByRole("button", { name: "Marcar como entregado" }).click();
    await expect(page.getByText(`Pedido ${n1}: entregado.`)).toBeVisible();
    await expect.poll(() => orderState(client, first), { timeout: 15_000 }).toBe("entregado/pagado");

    // Cancelar el segundo (en preparación) exige motivo y devuelve el stock
    await page.getByRole("tab", { name: /En preparación/ }).click();
    await page.getByRole("button", { name: new RegExp(`Pedido ${n2}(?!\\d)`) }).click();
    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Cancelar pedido" })).toBeDisabled();
    await dialog.getByLabel("Motivo").fill("el cliente no responde");
    await dialog.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect.poll(() => orderState(client, second), { timeout: 15_000 }).toBe("cancelado/pendiente");
    expect(await stockOf(shop.owner, shop.variantId)).toBe(9);
    await expect(page.getByRole("tab", { name: /Terminados/, selected: true })).toBeVisible();
    await expect(page.getByText("Motivo: el cliente no responde")).toBeVisible();
  });
});
