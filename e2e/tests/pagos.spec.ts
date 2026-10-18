import { type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { openShop, orderState, placeOrder, signedInClient, stockOf } from "../support/shop";
import { completedEventFor, functionsUrl, hasStripe, internalSecret, postWebhook, signedHeader, stripeGet, stripeHint } from "../support/stripe";

const anon = process.env.SUPABASE_ANON_KEY!;

async function startCheckout(client: SupabaseClient, orderId: string) {
  const { data } = await client.auth.getSession();
  const response = await fetch(`${functionsUrl()}/stripe-checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session!.access_token}`, apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ order_id: orderId }),
  });
  return { status: response.status, body: (await response.json()) as { url?: string; session_id?: string; error?: string } };
}

/** Paga en la página alojada de Stripe con la tarjeta de prueba 4242. */
async function payOnStripe(page: Page, checkoutUrl: string) {
  await page.goto(checkoutUrl);
  await page.locator("#email").fill("cliente-pagos@e2e.test");
  await page.locator("#cardNumber").fill("4242424242424242");
  await page.locator("#cardExpiry").fill("1234");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("Cliente de Pagos");
  await page.locator(".SubmitButton").click();
  await page.waitForURL(/pago=ok/, { timeout: 90_000 });
}

test.describe("@stripe pagos con tarjeta · Stripe en modo prueba", () => {
  test.skip(!hasStripe, stripeHint);

  test("el cliente paga, el webhook confirma el pedido y, al cancelarlo, se reembolsa en Stripe", async ({ page }) => {
    test.setTimeout(240_000);
    const { owner, storeId, variantId } = await openShop();
    const client = await signedInClient();

    const orderId = await placeOrder(client, storeId, variantId, 2);
    expect(await orderState(client, orderId)).toBe("pendiente_pago/pendiente");
    expect(await stockOf(owner, variantId)).toBe(8);

    // Sesión de pago real, con el monto que calcula la base de datos (2 × 150 + envío).
    const checkout = await startCheckout(client, orderId);
    expect(checkout.status, JSON.stringify(checkout.body)).toBe(200);
    expect(checkout.body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const session = await stripeGet(`/v1/checkout/sessions/${checkout.body.session_id}`);
    expect(session.client_reference_id).toBe(orderId);
    expect(session.amount_total).toBe(30000);

    // Otro cliente no puede iniciar el pago de un pedido ajeno.
    const stranger = await signedInClient();
    expect((await startCheckout(stranger, orderId)).status).toBe(404);

    await payOnStripe(page, checkout.body.url!);
    const paid = await stripeGet(`/v1/checkout/sessions/${checkout.body.session_id}`);
    expect(paid.payment_status).toBe("paid");

    // El webhook con datos reales: firma inválida se rechaza; la válida confirma el pedido; el reenvío no lo repite.
    const body = await completedEventFor(checkout.body.session_id!, `evt_e2e_${Date.now()}_a`);
    expect((await postWebhook(body, "t=1,v1=" + "0".repeat(64))).status).toBe(400);
    expect(await orderState(client, orderId)).toBe("pendiente_pago/pendiente");
    const first = await postWebhook(body, signedHeader(body));
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.outcome).toBe("pagado");
    expect(await orderState(client, orderId)).toBe("por_confirmar/pagado");
    const replay = await postWebhook(body, signedHeader(body));
    expect(replay.body.outcome).toBe("pagado");
    expect(JSON.stringify(replay.body)).not.toContain("reembols");

    // El cliente cancela el pedido pagado: pasa a reembolso pendiente, el stock vuelve y la función de reembolsos devuelve el dinero.
    const { error: cancelError } = await client.rpc("set_order_status", { p_order: orderId, p_to: "cancelado", p_reason: "ya no lo necesito" });
    expect(cancelError).toBeNull();
    expect(await orderState(client, orderId)).toBe("cancelado/reembolso_pendiente");
    expect(await stockOf(owner, variantId)).toBe(10);

    const refunds = await fetch(`${functionsUrl()}/process-refunds`, { method: "POST", headers: { "x-outbox-secret": internalSecret! } });
    expect(refunds.status).toBe(200);
    expect((await refunds.json()).refunded).toBeGreaterThanOrEqual(1);
    expect(await orderState(client, orderId)).toBe("cancelado/reembolsado");
    const list = await stripeGet(`/v1/refunds?payment_intent=${paid.payment_intent}`);
    expect(list.data).toHaveLength(1);
    expect(list.data[0].status).toMatch(/succeeded|pending/);
    expect(list.data[0].amount).toBe(30000);
  });

  test("un pago que llega cuando el pedido ya se canceló se reembolsa solo", async ({ page }) => {
    test.setTimeout(240_000);
    const { owner, storeId, variantId } = await openShop();
    const client = await signedInClient();
    const orderId = await placeOrder(client, storeId, variantId, 1);
    const checkout = await startCheckout(client, orderId);
    expect(checkout.status).toBe(200);

    // El cliente cancela, pero la página de Stripe sigue abierta y alguien paga igual.
    const { error } = await client.rpc("set_order_status", { p_order: orderId, p_to: "cancelado", p_reason: "me equivoqué de tienda" });
    expect(error).toBeNull();
    expect(await stockOf(owner, variantId)).toBe(10);
    await payOnStripe(page, checkout.body.url!);

    const body = await completedEventFor(checkout.body.session_id!, `evt_e2e_${Date.now()}_b`);
    const result = await postWebhook(body, signedHeader(body));
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.outcome).toBe("reembolsar_tarde");
    expect(await orderState(client, orderId)).toBe("cancelado/pendiente");

    const paid = await stripeGet(`/v1/checkout/sessions/${checkout.body.session_id}`);
    const refunds = await stripeGet(`/v1/refunds?payment_intent=${paid.payment_intent}`);
    expect(refunds.data).toHaveLength(1);
    expect(refunds.data[0].amount).toBe(15000);

    // Reintentar el mismo evento no reembolsa dos veces.
    const again = await postWebhook(body, signedHeader(body));
    expect(again.status).toBe(200);
    expect((await stripeGet(`/v1/refunds?payment_intent=${paid.payment_intent}`)).data).toHaveLength(1);
  });
});
