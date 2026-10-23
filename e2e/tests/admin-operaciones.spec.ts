import { expect, test } from "@playwright/test";
import { backendHint, consoleClient, consoleSession, createCommerceAccount, createInvitation, createSuperadmin, hasBackend, PASSWORD, uniqueEmail } from "../support/backend";
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

test.describe("@backend administración · dashboard de inicio", () => {
  test.skip(!hasBackend, backendHint);

  test("el director ve cifras del periodo, el gráfico de ventas y solicitudes en una sola tabla", async ({ page }) => {
    test.setTimeout(120_000);
    const director = await createSuperadmin();
    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola", { timeout: 30_000 });

    // El mes es el periodo por defecto; el gráfico de ventas está disponible y cambiar de periodo actualiza la URL
    await expect(page.getByRole("link", { name: "Mes" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("img", { name: /Ventas por día/ })).toBeVisible();
    await page.getByRole("link", { name: "7 días" }).click();
    await expect(page).toHaveURL(/periodo=7d/);
    await expect(page.getByRole("link", { name: "7 días" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Mes" })).not.toHaveAttribute("aria-current");
    await expectNoViolations(page);

    // Hoy no hay tendencia que dibujar y la pantalla lo explica en lugar de mostrar un gráfico vacío
    await page.getByRole("link", { name: "Hoy" }).click();
    await expect(page.getByText("Elige 7 días, Quincena o Mes para ver la tendencia")).toBeVisible();

    // Solicitudes: una tabla con filtros por estado y búsqueda, no dos secciones
    await page.goto(`${CONSOLE_URL}/admin/solicitudes`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Solicitudes", { timeout: 30_000 });
    await expect(page.getByRole("tab", { name: /Pendientes/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Aprobadas/ })).toBeVisible();
    await expect(page.getByLabel("Buscar negocio")).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe("@backend administración · comercios y vendedores", () => {
  test.skip(!hasBackend, backendHint);

  test("comercios y vendedores tienen cada uno su apartado con búsqueda y filtro de estado", async ({ page }) => {
    test.setTimeout(180_000);
    const unique = Date.now();
    const company = await createCommerceAccount(`Distribuidora ${unique}`, { business_kind: "empresa", ruc: `J${String(unique).slice(-13).padStart(13, "0")}` });
    const vendor = await createCommerceAccount(`Frutas de Marta ${unique}`);
    expect(company.businessName).not.toBe(vendor.businessName);

    const director = await createSuperadmin();
    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });

    // El menú los distingue
    await expect(page.getByRole("link", { name: "Comercios", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vendedores", exact: true })).toBeVisible();

    // Comercios: solo empresas, con RUC y búsqueda
    await page.getByRole("link", { name: "Comercios", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comercios", { timeout: 30_000 });
    await expect(page.getByRole("columnheader", { name: "RUC" })).toBeVisible();
    await expect(page.getByRole("link", { name: company.businessName })).toBeVisible();
    await expect(page.getByRole("link", { name: vendor.businessName })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Buscar comercio" }).fill(`distribuidora ${unique}`);
    await expect(page.getByRole("status")).toContainText("1 de");
    await page.getByRole("searchbox", { name: "Buscar comercio" }).fill("zzzz-no-existe");
    await expect(page.getByText("Ningún comercio coincide")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expectNoViolations(page);

    // Vendedores: solo vendedores propios, sin columna de RUC; el detalle vuelve a Vendedores
    await page.getByRole("link", { name: "Vendedores", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vendedores", { timeout: 30_000 });
    await expect(page.getByRole("columnheader", { name: "RUC" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: company.businessName })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Buscar vendedor" }).fill(`marta ${unique}`);
    await page.getByRole("link", { name: vendor.businessName }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(vendor.businessName, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Vendedores", exact: true }).first()).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe("@backend administración · catálogo maestro", () => {
  test.skip(!hasBackend, backendHint);

  test("el director ve los productos de los comercios con sus ventas, los busca, los edita y los oculta; las categorías son otra pestaña", async ({ page }) => {
    test.setTimeout(240_000);
    const unique = Date.now();
    const product = `Café catálogo ${unique}`;
    const shop = await openShop("Comercio del catálogo", { store: `Tienda ${unique}`, product });
    const client = await signedInClient();
    const order = await placeOrder(client, shop.storeId, shop.variantId, 3, "efectivo");
    for (const to of ["confirmado"]) expect((await shop.owner.rpc("set_order_status", { p_order: order, p_to: to })).error).toBeNull();

    const director = await createSuperadmin();
    const api = await consoleClient(director.email, director.password);
    const category = `Bebidas ${unique}`;
    expect((await api.rpc("create_master_item", { p_kind: "categoria", p_name: category })).error).toBeNull();

    // Otra cuenta para la interfaz: la anterior ya enroló su segundo factor por API
    const uiDirector = await createSuperadmin();
    await signInAndEnroll(page, uiDirector.email, uiDirector.password);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
    await page.goto(`${CONSOLE_URL}/admin/catalogo`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catálogo maestro", { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Productos" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Categorías" })).toBeVisible();
    await expect(page.getByText("Productos en el catálogo")).toBeVisible();
    await expect(page.getByText("En punto de reorden")).toBeVisible();

    // Búsqueda: el producto aparece con las unidades vendidas este mes
    await page.getByRole("searchbox", { name: "Buscar producto" }).fill(`cafe catalogo ${unique}`);
    const row = page.getByRole("row", { name: new RegExp(product) });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "3", exact: true })).toBeVisible();
    await expectNoViolations(page);

    // Edición: le asigna una categoría
    await row.getByRole("button", { name: `Editar ${product}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Categoría").selectOption({ label: category });
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("row", { name: new RegExp(product) }).getByText(category)).toBeVisible({ timeout: 30_000 });

    // Ocultar exige motivo y lo deja como borrador
    await page.getByRole("button", { name: `Editar ${product}` }).click();
    const hide = page.getByRole("dialog").getByRole("button", { name: "Ocultar producto" });
    await expect(hide).toBeDisabled();
    await page.getByRole("dialog").getByLabel("Motivo").fill("la foto no corresponde al producto");
    await hide.click();
    await expect(page.getByRole("row", { name: new RegExp(product) }).getByText("Borrador")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Borradores/ }).click();
    await expect(page.getByRole("row", { name: new RegExp(product) })).toBeVisible();

    // Categorías: la gestión de clasificación sigue en su pestaña
    await page.getByRole("link", { name: "Categorías" }).click();
    await expect(page).toHaveURL(/pestana=categorias/);
    await expect(page.getByRole("tablist", { name: "Clase de elemento" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(category).locator("visible=true").first()).toBeVisible();
    await expectNoViolations(page);
  });
});

test.describe("@backend administración · repartidores", () => {
  test.skip(!hasBackend, backendHint);

  test("el director ve la flota con su ranking, entra a la ficha de un repartidor y la gestiona", async ({ page }) => {
    test.setTimeout(240_000);
    const unique = Date.now();
    const shop = await openShop("Comercio de repartos", { store: `Tienda ${unique}`, product: `Café reparto ${unique}` });
    const client = await signedInClient();
    const order = await placeOrder(client, shop.storeId, shop.variantId, 1, "efectivo");
    for (const to of ["confirmado", "preparando", "listo"]) expect((await shop.owner.rpc("set_order_status", { p_order: order, p_to: to })).error).toBeNull();

    const director = await createSuperadmin();
    const api = await consoleClient(director.email, director.password);
    const courierName = `Repartidor ${unique}`;
    const courierId = (await api.rpc("create_courier", { p_full_name: courierName, p_phone: "88880000", p_vehicle_type: "moto" })).data as string;
    expect((await api.rpc("assign_order_courier", { p_order: order, p_courier: courierId })).error).toBeNull();
    for (const to of ["en_camino", "entregado"]) expect((await api.rpc("set_order_status", { p_order: order, p_to: to })).error).toBeNull();

    const uiDirector = await createSuperadmin();
    await signInAndEnroll(page, uiDirector.email, uiDirector.password);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
    await page.goto(`${CONSOLE_URL}/admin/repartidores`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Repartidores", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Más entregas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Más kilómetros" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Más rápidos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuevo repartidor" })).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar repartidor" }).fill(`repartidor ${unique}`);
    await expectNoViolations(page);

    // La ficha: cifras, gráficos y gestión
    await page.getByRole("link", { name: courierName }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(courierName, { timeout: 30_000 });
    await expect(page.getByText(/Entregas \(este mes\)/)).toBeVisible();
    await expect(page.getByText("Tiempo promedio")).toBeVisible();
    await expect(page.getByRole("img", { name: /Entregas por día/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gestionar repartidor" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Entregado" })).toBeVisible();
    await expectNoViolations(page);
    await page.getByRole("link", { name: "Repartidores", exact: true }).first().click();
    await expect(page).toHaveURL(/\/admin\/repartidores$/);
  });
});
