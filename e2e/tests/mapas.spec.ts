import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { backendHint, createSuperadmin, createUser, hasBackend, PASSWORD, totp, uniqueEmail } from "../support/backend";
import { fillCode, signIn, signInAndEnroll } from "../support/console";
import { openShop, signedInClient } from "../support/shop";
import { CONSOLE_URL, STORE_URL } from "../support/urls";

/** Centro de Managua. La ubicación del navegador se simula, así que la prueba no depende de la red de Mapbox ni de su token. */
const MANAGUA = { latitude: 12.1364, longitude: -86.2514 };
const METROCENTRO = { latitude: 12.128, longitude: -86.2649 };

/**
 * Mapas (etapas M1 y M2): el comercio ubica su tienda y el cliente deja el pin de su destino. Con token de Mapbox el mapa se
 * dibuja; sin él (como en el CI) el selector conserva «Usar mi ubicación», que es lo que ejercita esta prueba.
 */
test.describe("@backend mapas · ubicación de tienda y destino del pedido", () => {
  test.skip(!hasBackend, backendHint);

  test("el comercio ubica su tienda con el pin", async ({ page, context }) => {
    test.setTimeout(180_000);
    const shop = await openShop("Comercio con mapa", { store: `Tienda mapa ${Date.now()}` });
    await context.grantPermissions(["geolocation"], { origin: CONSOLE_URL });
    // La tienda ya nace ubicada en el centro de Managua: se la mueve a Metrocentro.
    await context.setGeolocation(METROCENTRO);

    await signIn(page, shop.account.email, shop.account.password);
    await fillCode(page, totp(shop.ownerSecret));
    await expect(page).toHaveURL(/\/comercio$/, { timeout: 30_000 });

    await page.goto(`${CONSOLE_URL}/comercio/tiendas/${shop.storeId}`);
    const picker = page.getByRole("group", { name: "Punto exacto de la tienda" });
    await expect(page.getByRole("button", { name: "Guardar ubicación" })).toBeDisabled();
    await picker.getByRole("button", { name: "Usar mi ubicación" }).click();
    await expect(picker.getByText("Punto marcado: 12.12800, -86.26490.")).toBeVisible();
    await page.getByRole("button", { name: "Guardar ubicación" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ubicación guardada." })).toBeVisible();

    const { data } = await shop.owner.from("stores_list").select("latitude, longitude").eq("id", shop.storeId).single();
    expect(Number(data!.latitude)).toBeCloseTo(METROCENTRO.latitude, 4);
    expect(Number(data!.longitude)).toBeCloseTo(METROCENTRO.longitude, 4);

    // Quitar el pin deja la tienda sin ubicar (y sin poder recibir pedidos).
    await picker.getByRole("button", { name: "Quitar el pin" }).click();
    await page.getByRole("button", { name: "Guardar ubicación" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ubicación quitada." })).toBeVisible();
    const cleared = await shop.owner.from("stores_list").select("latitude").eq("id", shop.storeId).single();
    expect(cleared.data!.latitude).toBeNull();
  });

  test("administración ve la ruta tienda–destino y el comercio solo la distancia, sin el punto del cliente", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const shop = await openShop("Comercio con ruta", { store: `Tienda ruta ${Date.now()}` });
    // Tienda en Metrocentro y destino cerca de la Plaza de la Fe, unos 3,7 km en línea recta.
    const located = await shop.owner.rpc("set_store_location", { p_store: shop.storeId, p_latitude: 12.128, p_longitude: -86.2649 });
    expect(located.error).toBeNull();
    const client = await signedInClient();
    const created = await client.rpc("create_order", {
      p_store: shop.storeId,
      p_items: [{ variant_id: shop.variantId, quantity: 1 }],
      p_payment_method: "efectivo",
      p_address: "Cerca de la Plaza de la Fe",
      p_phone: "88881111",
      p_latitude: 12.1594,
      p_longitude: -86.2744,
    });
    expect(created.error).toBeNull();
    const number = String((await client.from("orders_list").select("number").eq("id", created.data as string).single()).data!.number);

    // Administración: mapa con los dos puntos, y distancia y tiempo (por calle con Mapbox, en línea recta sin él).
    const director = await createSuperadmin();
    await signInAndEnroll(page, director.email, director.password);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
    await page.goto(`${CONSOLE_URL}/admin/pedidos?pedido=${number}`);
    await expect(page.getByText("Ruta de entrega")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/por calle|en línea recta/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Destino del cliente:")).toBeVisible();
    await expect(page.getByText("12.12800, -86.26490")).toBeVisible();

    // Comercio: solo la distancia aproximada. Ni el punto ni el mapa del cliente.
    // Otro contexto: la sesión del director y la del comercio no pueden compartir cookies.
    const owner = await (await browser.newContext()).newPage();
    await signIn(owner, shop.account.email, shop.account.password);
    await fillCode(owner, totp(shop.ownerSecret));
    await expect(owner).toHaveURL(/\/comercio$/, { timeout: 30_000 });
    await owner.goto(`${CONSOLE_URL}/comercio/pedidos`);
    await owner.getByRole("button", { name: new RegExp(`Pedido ${number}(?!\\d)`) }).click();
    await expect(owner.getByText(/Distancia al cliente: unos \d+,\d km en línea recta/)).toBeVisible({ timeout: 30_000 });
    await expect(owner.getByText("Destino del cliente")).toHaveCount(0);
    await expect(owner.getByText("12.15940")).toHaveCount(0);
  });

  test("el cliente guarda una dirección con pin y su pedido conserva el punto", async ({ page, context }) => {
    test.setTimeout(180_000);
    const shop = await openShop("Comercio para el pin", { store: `Tienda pin ${Date.now()}` });
    const email = uniqueEmail("cliente-mapa");
    await createUser(email, { fullName: "Ana Mapa" });
    await context.grantPermissions(["geolocation"], { origin: STORE_URL });
    await context.setGeolocation(MANAGUA);

    await page.goto(`${STORE_URL}/ingresar?next=%2Fperfil%2Fdirecciones`);
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(page).toHaveURL(/\/perfil\/direcciones$/, { timeout: 30_000 });

    // Libreta de direcciones: la dirección escrita y su pin.
    await page.getByRole("button", { name: "Agregar dirección" }).click();
    await page.getByLabel("Nombre", { exact: true }).fill("Casa");
    await page.getByLabel("Dirección de entrega").fill("Barrio Central, casa 4, portón azul");
    await page.getByLabel("Departamento", { exact: true }).selectOption("managua");
    await page.getByRole("button", { name: "Usar mi ubicación" }).click();
    await expect(page.getByText("Punto marcado: 12.13640, -86.25140.")).toBeVisible();
    await page.getByRole("button", { name: "Guardar dirección" }).click();
    await expect(page.getByText("Con punto marcado en el mapa")).toBeVisible();

    // Checkout: el pin viene de la dirección guardada. El carrito se siembra una sola vez por pestaña.
    await page.addInitScript(
      ([key, cart]) => {
        if (sessionStorage.getItem("e2e-cart-seeded")) return;
        sessionStorage.setItem("e2e-cart-seeded", "1");
        localStorage.setItem(key, cart);
      },
      ["rapitrip-cart-v2", JSON.stringify({ lines: [{ storeId: shop.storeId, storeName: "Tienda", variantId: shop.variantId, quantity: 1, seenPrice: 150 }] })] as const,
    );
    await page.goto(`${STORE_URL}/checkout`);
    await expect(page.getByText("Punto marcado: 12.13640, -86.25140.")).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Teléfono de contacto").fill("88881111");
    await page.getByRole("radio", { name: /Efectivo contra entrega/ }).check();
    await page.getByRole("button", { name: "Confirmar pedido" }).click();
    await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(page.getByText(/Punto de entrega:/)).toBeVisible();

    // La base de datos guardó el pin con el pedido.
    const orderId = page.url().split("/").pop()!;
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    expect(error).toBeNull();
    const { data } = await client.from("order_delivery_list").select("latitude, longitude").eq("order_id", orderId).single();
    expect(Number(data!.latitude)).toBeCloseTo(MANAGUA.latitude, 4);
    expect(Number(data!.longitude)).toBeCloseTo(MANAGUA.longitude, 4);
  });
});
