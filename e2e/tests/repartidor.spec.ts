import { createHash, randomBytes } from "node:crypto";
import { expect, test, devices, type Page } from "@playwright/test";
import { admin, backendHint, consoleClient, createSuperadmin, createUser, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { openShop, orderState, placeOrder, signedInClient } from "../support/shop";
import { COURIER_URL } from "../support/urls";

/** PNG de 1×1 válido: basta para que la app lo reduzca, lo firme (SHA-256) y lo suba. */
const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC", "base64");

async function typeCode(page: Page, label: string, code: string) {
  for (const [i, digit] of [...code].entries()) await page.getByLabel(`${label}, dígito ${i + 1} de 4`).fill(digit);
}

async function takePhoto(page: Page, name: RegExp) {
  await page.locator('input[type="file"]').first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PHOTO });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
}

const { defaultBrowserType: _browser, ...phone } = devices["Pixel 5"];

/**
 * El repartidor con su teléfono: recibe la propuesta, la acepta, recoge con foto y código del comercio, entrega con foto y código del
 * cliente. Coordinación, comercio y cliente actúan por API (sus pantallas ya tienen sus propias pruebas).
 */
test.describe("@backend app del repartidor", () => {
  test.skip(!hasBackend, backendHint);
  test.use({ ...phone, locale: "es", timezoneId: "America/Managua", contextOptions: { reducedMotion: "reduce" } });

  test("propuesta, recogida y entrega con evidencias, y visibilidad por rol", async ({ browser }) => {
    test.setTimeout(300_000);
    const unique = Date.now();
    const shop = await openShop("Comercio del repartidor", { store: `Tienda ${unique}`, product: `Café ${unique}` });
    const client = await signedInClient();
    const orderId = await placeOrder(client, shop.storeId, shop.variantId, 1, "efectivo");

    // Comercio: confirma, prepara y deja listo. Coordinación: crea la ficha del repartidor y lo invita.
    for (const to of ["confirmado", "preparando", "listo"]) {
      const { error } = await shop.owner.rpc("set_order_status", { p_order: orderId, p_to: to });
      expect(error, to).toBeNull();
    }
    expect(await orderState(client, orderId)).toBe("listo/pendiente");

    const director = await createSuperadmin();
    const api = await consoleClient(director.email, director.password);
    const created = await api.rpc("create_courier", { p_full_name: `Repartidor ${unique}`, p_phone: "88880000", p_vehicle_type: "moto" });
    expect(created.error).toBeNull();
    const courierId = created.data as string;
    const courierEmail = uniqueEmail("repartidor");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    expect((await api.rpc("create_courier_invitation", { p_courier: courierId, p_email: courierEmail, p_token_hash: tokenHash })).error).toBeNull();
    const courierUser = await createUser(courierEmail, { fullName: `Repartidor ${unique}` });
    expect((await admin().rpc("finish_accept_invitation", { p_token_hash: tokenHash, p_user: courierUser.id })).error).toBeNull();

    // El repartidor entra desde el teléfono (sin segundo factor) y se pone disponible.
    const context = await browser.newContext({ ...devices["Pixel 5"], locale: "es", timezoneId: "America/Managua", reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${COURIER_URL}/ingresar`);
    await page.getByLabel("Correo").fill(courierEmail);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(page).toHaveURL(`${COURIER_URL}/`, { timeout: 30_000 });
    await page.getByRole("button", { name: "Empezar" }).click();
    await expect(page.getByText("Estoy disponible")).toBeVisible({ timeout: 30_000 });
    expect((await api.rpc("offer_order_to_courier", { p_order: orderId, p_courier: courierId })).error).toBeNull();

    // La propuesta aparece con cuenta regresiva; la acepta.
    await page.reload();
    await expect(page.getByText("Nueva propuesta")).toBeVisible({ timeout: 30_000 });
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Aceptar" }).click();
    await page.goto(`${COURIER_URL}/pedidos/${orderId}`);

    // Recoger: sin foto no se puede confirmar; con un código equivocado, tampoco.
    await expect(page.getByRole("heading", { name: "Recoger en la tienda" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Confirmar recogida" })).toBeDisabled();
    await takePhoto(page, /Foto lista/);
    const pickup = (await shop.owner.rpc("order_pickup_code", { p_order: orderId })).data as { code: string } | string;
    const pickupCode = typeof pickup === "string" ? pickup : pickup.code;
    const wrong = pickupCode === "0000" ? "1111" : "0000";
    await typeCode(page, "2. Código de recogida (te lo muestra el comercio)", wrong);
    await page.getByRole("button", { name: "Confirmar recogida" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await typeCode(page, "2. Código de recogida (te lo muestra el comercio)", pickupCode);
    await page.getByRole("button", { name: "Confirmar recogida" }).click();

    // Entregar: foto en el lugar, código del cliente y monto cobrado.
    await expect(page.getByRole("heading", { name: "Entregar al cliente" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Confirmar entrega" })).toBeDisabled();
    await takePhoto(page, /Foto lista/);
    const delivery = (await client.rpc("my_delivery_code", { p_order: orderId })).data as { code: string } | string;
    const deliveryCode = typeof delivery === "string" ? delivery : delivery.code;
    await page.getByLabel("Monto que cobraste").fill("200");
    await typeCode(page, "2. Código de entrega (te lo da el cliente)", deliveryCode);
    await page.getByRole("button", { name: "Confirmar entrega" }).click();
    await expect(page.getByText("Entrega registrada")).toBeVisible({ timeout: 30_000 });
    await expectNoViolations(page);
    await expect.poll(() => orderState(client, orderId), { timeout: 15_000 }).toMatch(/^entregado\//);

    // Cadena de evidencias: recogida y entrega, cada una con su huella. El comercio solo ve la de recogida; el cliente, la suya.
    const kinds = (rows: { kind: string }[] | null) => (rows ?? []).map((r) => r.kind).sort();
    const all = await api.from("order_evidence_list").select("kind, sha256").eq("order_id", orderId);
    expect(kinds(all.data)).toEqual(expect.arrayContaining(["entrega", "recogida"]));
    for (const row of all.data ?? []) expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    const asShop = await shop.owner.from("order_evidence_list").select("kind").eq("order_id", orderId);
    expect(kinds(asShop.data)).not.toContain("entrega");
    const asClient = await client.from("order_evidence_list").select("kind").eq("order_id", orderId);
    expect(kinds(asClient.data)).not.toContain("recogida");

    // El historial del repartidor lo lista.
    await page.goto(`${COURIER_URL}/historial`);
    await expect(page.getByRole("link", { name: /Pedido \d+.*por rendir/ })).toBeVisible({ timeout: 30_000 });
    await context.close();
  });
});
