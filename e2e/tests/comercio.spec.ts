import { expect, test, type Page } from "@playwright/test";
import { backendHint, consoleClient, consoleSession, createCommerceAccount, createSuperadmin, hasBackend, totp } from "../support/backend";
import { expectNoViolations } from "../support/axe";
import { fillCode, signIn, signInAndEnroll } from "../support/console";
import { openShop, orderState, placeOrder, signedInClient, stockOf } from "../support/shop";
import { CONSOLE_URL } from "../support/urls";

/** PNG de 1×1 píxel: suficiente para probar la subida con las políticas reales de Storage. */
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/** La ubicación de la tienda es obligatoria: se marca con «Usar mi ubicación» (la del navegador se simula en el centro de Managua). */
async function markStoreLocation(page: Page) {
  await page.context().grantPermissions(["geolocation"], { origin: CONSOLE_URL });
  await page.context().setGeolocation({ latitude: 12.1364, longitude: -86.2514 });
  await page.getByRole("button", { name: "Usar mi ubicación" }).click();
  await expect(page.getByText("Punto marcado: 12.13640, -86.25140.")).toBeVisible();
}

async function createStore(page: Page, name: string) {
  await page.goto(`${CONSOLE_URL}/comercio/tiendas`);
  await page.getByRole("button", { name: "Nueva tienda" }).click();
  await page.getByLabel("Nombre de la tienda").fill(name);
  await expect(page.getByRole("button", { name: "Crear tienda" })).toBeDisabled();
  await markStoreLocation(page);
  await page.getByRole("button", { name: "Crear tienda" }).click();
  await expect(page).toHaveURL(/\/comercio\/tiendas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

test.describe("@backend consola · área de comercio (Fase 2)", () => {
  test.skip(!hasBackend, backendHint);

  test("el comercio crea su tienda con horario, publica un producto con imagen y controla su inventario", async ({ page }) => {
    // Recorre cinco pantallas y sube un archivo; en `next dev` la primera visita de cada ruta compila.
    test.setTimeout(180_000);
    const account = await createCommerceAccount("Café E2E");
    await signInAndEnroll(page, account.email, account.password);
    await expect(page).toHaveURL(/\/comercio$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola");
    await expectNoViolations(page);

    // Tienda y horario
    await createStore(page, "Sucursal Centro");
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Agregar tramo" }).first().click();
    await page.getByLabel("Lunes, apertura 1").fill("00:00");
    await page.getByLabel("Lunes, cierre 1").fill("23:59");
    await page.getByRole("button", { name: "Copiar a todos" }).click();
    await page.getByRole("button", { name: "Guardar horario" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Horario guardado." })).toBeVisible();

    await page.goto(`${CONSOLE_URL}/comercio/tiendas`);
    await expect(page.getByText("Abierta ahora")).toBeVisible();

    // Cierre temporal: la tienda deja de estar abierta y se puede reabrir
    await page.getByRole("link", { name: /Sucursal Centro/ }).click();
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Reabre el").fill(`${tomorrow}T08:00`);
    await page.getByRole("button", { name: "Cerrar temporalmente" }).click();
    await expect(page.getByText("Cierre temporal programado.")).toBeVisible();
    await expect(page.getByText("Cerrada temporalmente").first()).toBeVisible();
    await page.getByRole("button", { name: "Reabrir ahora" }).click();
    await expect(page.getByText("La tienda se reabrió.")).toBeVisible();

    // Producto, variante, imagen y publicación
    await page.goto(`${CONSOLE_URL}/comercio/catalogo`);
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Nuevo producto" }).click();
    await page.getByLabel("Nombre del producto").fill("Café molido");
    await page.getByRole("button", { name: "Crear producto" }).click();
    await expect(page).toHaveURL(/\/comercio\/catalogo\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("button", { name: "Publicar" })).toBeDisabled();

    await page.getByLabel("Nombre de la variante").fill("Bolsa 500 g");
    await page.getByLabel("SKU").fill("CAFE-500");
    await page.getByLabel("Precio").fill("4500.50");
    await page.getByRole("button", { name: "Agregar variante" }).click();
    await expect(page.getByText("Variante agregada.")).toBeVisible();
    await expect(page.getByText("SKU CAFE-500")).toBeVisible();

    await page.getByLabel("Elegir imagen").setInputFiles({ name: "cafe.png", mimeType: "image/png", buffer: PIXEL });
    await expect(page.getByText("Imagen agregada.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Imagen 1 de Café molido" })).toBeVisible();

    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByText("Producto publicado.")).toBeVisible();
    await expectNoViolations(page);

    // El SKU es único en la tienda
    await page.getByLabel("Nombre de la variante").fill("Bolsa 1 kg");
    await page.getByLabel("SKU").fill("cafe-500");
    await page.getByLabel("Precio").fill("8000");
    await page.getByRole("button", { name: "Agregar variante" }).click();
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("ya existe una variante con ese SKU");

    // Inventario: control, entrada con motivo y alerta de stock bajo
    await page.goto(`${CONSOLE_URL}/comercio/inventario`);
    await page.getByRole("tab", { name: "Todos" }).click();
    await page.getByRole("button", { name: "Ajustar Café molido, Bolsa 500 g" }).click();
    await page.getByLabel("Controlar stock de esta variante").check();
    await page.getByLabel("Avisar cuando queden").fill("3");
    await page.getByRole("button", { name: "Guardar control" }).click();
    await expect(page.getByText("Control guardado.")).toBeVisible();
    await page.getByLabel("Cantidad", { exact: true }).fill("2");
    await page.getByLabel("Motivo").fill("compra inicial");
    await page.getByRole("button", { name: "Registrar movimiento" }).click();
    await expect(page.getByText("Movimiento registrado.")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByText("Stock bajo", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Requieren atención" }).click();
    await expect(page.getByText("Café molido")).toBeVisible();
    await expectNoViolations(page);

    await page.goto(`${CONSOLE_URL}/comercio`);
    await expect(page.getByText("Stock por reponer")).toBeVisible();
  });

  test("un comercio no ve ni puede abrir las tiendas de otro", async ({ page }) => {
    const first = await createCommerceAccount("Comercio Uno");
    const second = await createCommerceAccount("Comercio Dos");

    // El primero crea su tienda por la API con su propia sesión de consola.
    const api = await consoleClient(first.email, first.password).catch(() => null);
    expect(api, "el comercio debe poder iniciar sesión de consola").not.toBeNull();
    const { data: role } = await api!.from("my_roles").select("commerce_id").eq("role", "comercio").single();
    const { data: storeId, error } = await api!.rpc("create_store", { p_commerce: role!.commerce_id!, p_name: "Tienda privada" });
    expect(error).toBeNull();

    // El segundo comercio prepara su sesión por la API (con secreto conocido) y luego entra por la interfaz.
    const intruder = await consoleSession(second.email, second.password);
    await signIn(page, second.email, second.password);
    await fillCode(page, totp(intruder.secret));
    await expect(page).toHaveURL(/\/comercio$/);
    await page.goto(`${CONSOLE_URL}/comercio/tiendas`);
    await expect(page.getByText("Todavía no tienes tiendas")).toBeVisible();
    await expect(page.getByText("Tienda privada")).toHaveCount(0);

    const response = await page.goto(`${CONSOLE_URL}/comercio/tiendas/${storeId}`);
    expect(response?.status()).toBe(404);

    // Y no puede escribir en la tienda ajena por la API.
    const { error: denied } = await intruder.client.rpc("update_store", { p_store: storeId!, p_name: "Robada" });
    expect(denied?.code).toBe("42501");
  });

  test("el director administra el catálogo maestro y el comercio lo ve como opción", async ({ page, browser }) => {
    const account = await createCommerceAccount("Comercio Catálogo");
    const director = await createSuperadmin();
    const categoria = `Bebidas ${Date.now()}`;

    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`${CONSOLE_URL}/admin/catalogo`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catálogo maestro");
    await page.getByLabel("Nueva categoría").fill(categoria);
    await page.getByRole("button", { name: "Agregar" }).click();
    await expect(page.getByText("Elemento agregado.")).toBeVisible();
    await expect(page.getByRole("listitem").getByText(categoria)).toBeVisible();
    await expectNoViolations(page);

    const context = await browser.newContext();
    const owner = await context.newPage();
    await signInAndEnroll(owner, account.email, account.password);
    await expect(owner).toHaveURL(/\/comercio$/);
    await owner.goto(`${CONSOLE_URL}/comercio/tiendas`);
    await owner.getByRole("button", { name: "Nueva tienda" }).click();
    await owner.getByLabel("Nombre de la tienda").fill("Tienda Catálogo");
    await markStoreLocation(owner);
    await owner.getByRole("button", { name: "Crear tienda" }).click();
    await expect(owner).toHaveURL(/\/comercio\/tiendas\/[0-9a-f-]{36}$/);
    await owner.goto(`${CONSOLE_URL}/comercio/catalogo`);
    await owner.getByRole("button", { name: "Nuevo producto" }).click();
    await owner.getByLabel("Nombre del producto").fill("Jugo");
    await owner.getByRole("button", { name: "Crear producto" }).click();
    await expect(owner.getByLabel("Categoría")).toContainText(categoria);
    await context.close();
  });

  test("el director ve las tiendas de un comercio y lo suspende: el comercio pierde el acceso", async ({ page }) => {
    test.setTimeout(120_000);
    const businessName = `Comercio Suspendible ${Date.now()}`;
    const account = await createCommerceAccount(businessName);
    const owner = await consoleSession(account.email, account.password);
    const { data: role } = await owner.client.from("my_roles").select("commerce_id").eq("role", "comercio").single();
    const { error: createError } = await owner.client.rpc("create_store", { p_commerce: role!.commerce_id!, p_name: "Tienda a suspender" });
    expect(createError).toBeNull();

    const director = await createSuperadmin();
    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`${CONSOLE_URL}/admin/comercios`);
    await page.getByRole("link", { name: businessName }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(businessName, { timeout: 30_000 });
    await expect(page.getByText("Tienda a suspender")).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("button", { name: "Suspender comercio" }).click();
    await page.getByLabel("Motivo").fill("incumplimiento del convenio");
    await page.getByRole("button", { name: "Suspender", exact: true }).click();
    await expect(page.getByText("Suspendido", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reactivar comercio" })).toBeVisible();

    // El comercio suspendido deja de ver sus tiendas y no puede crear otras.
    const { data: stores } = await owner.client.from("stores_list").select("id");
    expect(stores).toEqual([]);
    const { error: denied } = await owner.client.rpc("create_store", { p_commerce: role!.commerce_id!, p_name: "Otra tienda" });
    expect(denied?.code).toBe("42501");

    // La acción queda en la auditoría con su etiqueta legible.
    await page.goto(`${CONSOLE_URL}/admin/auditoria`);
    await expect(page.locator("summary", { hasText: "Cambió el estado de un comercio" }).first()).toBeVisible({ timeout: 30_000 });
  });

  test("el comercio recibe pedidos, confirma uno hasta dejarlo listo y rechaza otro con motivo", async ({ page }) => {
    test.setTimeout(180_000);
    const shop = await openShop("Comercio de pedidos");
    const client = await signedInClient();
    const first = await placeOrder(client, shop.storeId, shop.variantId, 2, "efectivo");
    const second = await placeOrder(client, shop.storeId, shop.variantId, 1, "efectivo");
    const numberOf = async (id: string) => String((await client.from("orders_list").select("number").eq("id", id).single()).data!.number);
    const [n1, n2] = [await numberOf(first), await numberOf(second)];
    expect(await stockOf(shop.owner, shop.variantId)).toBe(7);

    await signIn(page, shop.account.email, shop.account.password);
    await fillCode(page, totp(shop.ownerSecret));
    await expect(page).toHaveURL(/\/comercio$/, { timeout: 30_000 });
    await expect(page.getByText("Pedidos por confirmar")).toBeVisible();

    await page.goto(`${CONSOLE_URL}/comercio/pedidos`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pedidos", { timeout: 30_000 });
    await expect(page.getByRole("tab", { name: /Por confirmar\s*2/ })).toBeVisible();
    await expectNoViolations(page);

    // Confirmar → preparar → listo
    await page.getByRole("button", { name: new RegExp(`Pedido ${n1}(?!\\d)`) }).click();
    await expect(page.getByText("Café molido · 500 g")).toBeVisible();
    await expect(page.getByText("Efectivo contra entrega")).toBeVisible();
    await expect(page.getByText(/Responde antes de/)).toBeVisible();
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText(`Pedido ${n1}: confirmado.`)).toBeVisible();
    // Tras responder, la lista pasa sola a «En curso» y el pedido sigue seleccionado.
    await expect(page.getByRole("tab", { name: /En curso/, selected: true })).toBeVisible();
    await page.getByRole("button", { name: "Empezar a preparar" }).click();
    await expect(page.getByText(`Pedido ${n1}: preparando.`)).toBeVisible();
    await page.getByRole("button", { name: "Marcar como listo" }).click();
    await expect(page.getByText(`Pedido ${n1}: listo.`)).toBeVisible();
    await expect(page.getByText("Coordinación se encarga de la entrega.")).toBeVisible();
    expect(await orderState(client, first)).toBe("listo/pendiente");

    // Rechazar el segundo exige motivo y devuelve el stock
    await page.getByRole("tab", { name: /Por confirmar/ }).click();
    await page.getByRole("button", { name: new RegExp(`Pedido ${n2}(?!\\d)`) }).click();
    await page.getByRole("button", { name: "Rechazar", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Rechazar", exact: true })).toBeDisabled();
    await dialog.getByLabel("Motivo").fill("sin existencias reales");
    await dialog.getByRole("button", { name: "Rechazar", exact: true }).click();
    await expect.poll(() => orderState(client, second), { timeout: 15_000 }).toBe("rechazado/pendiente");
    expect(await stockOf(shop.owner, shop.variantId)).toBe(8);
    await expect(page.getByRole("tab", { name: /Terminados/, selected: true })).toBeVisible();
    await expect(page.getByText("Motivo: sin existencias reales")).toBeVisible();

    // Inicio: nada por confirmar y la venta de hoy es la del pedido confirmado (2 × 150 + 50 de envío de la zona 1)
    await page.goto(`${CONSOLE_URL}/comercio`);
    await expect(page.getByText("Ventas de hoy")).toBeVisible();
    await expect(page.getByText(/350/).first()).toBeVisible();
    await expectNoViolations(page);
  });
});
