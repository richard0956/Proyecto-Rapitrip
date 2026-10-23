import { expect, test } from "@playwright/test";
import { backendHint, consoleClient, createInvitation, createSuperadmin, hasBackend, PASSWORD, totp, uniqueEmail } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { fillCode, signIn, signInAndEnroll } from "../support/console";
import { openShop, orderState, placeOrder, signedInClient, stockOf } from "../support/shop";
import { CONSOLE_URL } from "../support/urls";

/**
 * Un pedido de punta a punta, con cada persona en su propio navegador: el cliente pide (por API, porque el carrito de la tienda es F4),
 * el comercio lo confirma, prepara y deja listo; coordinación asigna repartidor, despacha y entrega; administración lo ve entregado.
 * Necesita las Edge Functions sirviéndose (`supabase functions serve`): coordinación acepta su invitación con `accept-invitation`.
 */
test.describe("@backend pedido de punta a punta", () => {
  test.skip(!hasBackend, backendHint);

  test("del pedido del cliente a la entrega, pasando por comercio, coordinación y administración", async ({ browser }) => {
    test.setTimeout(300_000);
    const unique = Date.now();
    const shop = await openShop("Comercio de punta a punta", { store: `Tienda ${unique}`, product: `Café ${unique}` });
    const client = await signedInClient();

    // 1. El cliente hace un pedido en efectivo: 2 cafés (300.00), el stock queda reservado.
    const orderId = await placeOrder(client, shop.storeId, shop.variantId, 2, "efectivo");
    const number = String((await client.from("orders_list").select("number").eq("id", orderId).single()).data!.number);
    expect(await orderState(client, orderId)).toBe("por_confirmar/pendiente");
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);
    const order = new RegExp(`Pedido ${number}(?!\\d)`);

    // 2. El comercio lo confirma, lo prepara y lo deja listo.
    const commerce = await (await browser.newContext()).newPage();
    await signIn(commerce, shop.account.email, shop.account.password);
    await fillCode(commerce, totp(shop.ownerSecret));
    await expect(commerce).toHaveURL(/\/comercio$/, { timeout: 30_000 });
    await expect(commerce.getByText("Pedidos por confirmar")).toBeVisible();
    await commerce.goto(`${CONSOLE_URL}/comercio/pedidos`);
    await commerce.getByRole("button", { name: order }).click();
    await commerce.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(commerce.getByText(`Pedido ${number}: confirmado.`)).toBeVisible({ timeout: 30_000 });
    await commerce.getByRole("button", { name: "Empezar a preparar" }).click();
    await expect(commerce.getByText(`Pedido ${number}: preparando.`)).toBeVisible();
    await commerce.getByRole("button", { name: "Marcar como listo" }).click();
    await expect(commerce.getByText(`Pedido ${number}: listo.`)).toBeVisible();
    expect(await orderState(client, orderId)).toBe("listo/pendiente");

    // 3. Coordinación (cuenta nueva por invitación) asigna repartidor, despacha y entrega.
    const setup = await createSuperadmin();
    const api = await consoleClient(setup.email, setup.password);
    const courierName = `Repartidor ${unique}`;
    expect((await api.rpc("create_courier", { p_full_name: courierName, p_phone: "88880000", p_vehicle_type: "moto" })).error).toBeNull();
    const coordEmail = uniqueEmail("coordinador");
    const token = await createInvitation(api, coordEmail, "coordinador");
    const accepted = await fetch(`${process.env.SUPABASE_URL}/functions/v1/accept-invitation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password: PASSWORD, full_name: "Coordinación de Punta a Punta" }),
    });
    expect(accepted.status).toBe(200);
    const coordination = await (await browser.newContext()).newPage();
    await signInAndEnroll(coordination, coordEmail, PASSWORD);
    await expect(coordination).toHaveURL(/\/coordinacion\/resumen$/, { timeout: 30_000 });
    await coordination.goto(`${CONSOLE_URL}/coordinacion`);
    await coordination.getByRole("button", { name: order }).click();
    await expect(coordination.getByText("Barrio Central, casa 4", { exact: true })).toBeVisible();
    await coordination.getByLabel("Repartidor").selectOption({ label: `${courierName} · moto` });
    await coordination.getByRole("button", { name: "Asignar repartidor" }).click();
    await expect(coordination.getByText("Repartidor asignado.")).toBeVisible();
    await coordination.getByRole("button", { name: "Despachar", exact: true }).click();
    await expect(coordination.getByText(`Pedido ${number}: en camino.`)).toBeVisible();
    await coordination.getByRole("button", { name: "Marcar como entregado" }).click();
    await expect(coordination.getByText(`Pedido ${number}: entregado.`)).toBeVisible();
    await expect.poll(() => orderState(client, orderId), { timeout: 15_000 }).toBe("entregado/pagado");

    // 4. Administración lo ve entregado y cobrado, con su repartidor; el stock sigue descontado.
    const director = await createSuperadmin();
    const admin = await (await browser.newContext()).newPage();
    await signInAndEnroll(admin, director.email, director.password);
    await expect(admin).toHaveURL(/\/admin$/, { timeout: 30_000 });
    await admin.goto(`${CONSOLE_URL}/admin/pedidos?pedido=${number}`);
    await expect(admin.getByRole("heading", { name: `Pedido ${number}` })).toBeVisible({ timeout: 30_000 });
    await expect(admin.getByRole("button", { name: new RegExp(`Pedido ${number}(?!\\d).*Entregado`) })).toBeVisible();
    await expect(admin.getByText("Efectivo · cobrado")).toBeVisible();
    await expect(admin.getByText(courierName)).toBeVisible();
    await expectNoViolations(admin);
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);
  });
});
