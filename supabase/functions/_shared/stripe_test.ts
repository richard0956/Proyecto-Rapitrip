import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { buildCheckoutParams, buildPurchaseCheckoutParams, purchaseTotalMinorUnits, refundParams, signStripePayload, stripeEventTarget, toMinorUnits, verifyStripeSignature, type Purchase } from "./stripe.ts";

const secret = "whsec_prueba_para_tests";
const payload = JSON.stringify({ id: "evt_test_1", type: "checkout.session.completed", data: { object: { id: "cs_test_1" } } });
const now = 1_800_000_000;

Deno.test("acepta una firma correcta", async () => {
  const header = await signStripePayload(payload, secret, now);
  assertEquals(await verifyStripeSignature(payload, header, secret, now), true);
});

Deno.test("rechaza una firma de otro secreto", async () => {
  const header = await signStripePayload(payload, "whsec_otro", now);
  assertEquals(await verifyStripeSignature(payload, header, secret, now), false);
});

Deno.test("rechaza un cuerpo alterado", async () => {
  const header = await signStripePayload(payload, secret, now);
  assertEquals(await verifyStripeSignature(payload.replace("cs_test_1", "cs_test_2"), header, secret, now), false);
});

Deno.test("rechaza una firma vieja (repetición) y acepta dentro de la tolerancia", async () => {
  const header = await signStripePayload(payload, secret, now);
  assertEquals(await verifyStripeSignature(payload, header, secret, now + 301), false);
  assertEquals(await verifyStripeSignature(payload, header, secret, now + 299), true);
});

Deno.test("rechaza cabeceras ausentes o mal formadas", async () => {
  assertEquals(await verifyStripeSignature(payload, null, secret, now), false);
  assertEquals(await verifyStripeSignature(payload, "", secret, now), false);
  assertEquals(await verifyStripeSignature(payload, "v1=abc", secret, now), false);
  assertEquals(await verifyStripeSignature(payload, `t=${now}`, secret, now), false);
  assertEquals(await verifyStripeSignature(payload, `t=${now},v1=deadbeef`, secret, now), false);
  assertEquals(await verifyStripeSignature(payload, await signStripePayload(payload, secret, now), "", now), false);
});

Deno.test("acepta la firma si alguna de varias v1 es válida (rotación del secreto)", async () => {
  const good = (await signStripePayload(payload, secret, now)).split(",v1=")[1];
  assertEquals(await verifyStripeSignature(payload, `t=${now},v1=${"0".repeat(64)},v1=${good}`, secret, now), true);
});

Deno.test("toMinorUnits convierte decimales a centavos sin errores de punto flotante", () => {
  assertEquals(toMinorUnits("150.00"), 15000);
  assertEquals(toMinorUnits(4500.5), 450050);
  assertEquals(toMinorUnits("0.29"), 29);
  assertEquals(toMinorUnits(1.15), 115);
  assertThrows(() => toMinorUnits(-1));
  assertThrows(() => toMinorUnits("abc"));
});

Deno.test("la sesión de pago suma exactamente el total del pedido e incluye el envío", () => {
  const params = buildCheckoutParams(
    { id: "11111111-1111-1111-1111-111111111111", number: 7, storeName: "Tienda A", deliveryFee: "35.50" },
    [
      { productName: "Café", variantName: "500 g", unitPrice: "150.00", quantity: 2 },
      { productName: "Pan", variantName: "Unidad", unitPrice: "12.35", quantity: 3 },
    ],
    { currency: "NIO", storeUrl: "http://127.0.0.1:3000", nowSeconds: 1000 },
  );
  assertEquals(params.mode, "payment");
  assertEquals(params.client_reference_id, "11111111-1111-1111-1111-111111111111");
  assertEquals(params["metadata[order_id]"], "11111111-1111-1111-1111-111111111111");
  assertEquals(params["line_items[0][price_data][currency]"], "nio");
  assertEquals(params["line_items[2][price_data][product_data][name]"], "Envío");
  assertEquals(params["line_items[2][price_data][unit_amount]"], "3550");
  assertEquals(params.success_url, "http://127.0.0.1:3000/pedidos/11111111-1111-1111-1111-111111111111?pago=ok");
  assertEquals(params.expires_at, String(1000 + 31 * 60));

  let total = 0;
  for (let i = 0; params[`line_items[${i}][quantity]`] !== undefined; i++) {
    total += Number(params[`line_items[${i}][quantity]`]) * Number(params[`line_items[${i}][price_data][unit_amount]`]);
  }
  assertEquals(total, 30000 + 3705 + 3550);
});

Deno.test("sin costo de envío no agrega renglón de envío", () => {
  const params = buildCheckoutParams(
    { id: "11111111-1111-1111-1111-111111111111", number: 1, storeName: "T", deliveryFee: 0 },
    [{ productName: "A", variantName: "B", unitPrice: 10, quantity: 1 }],
    { currency: "nio", storeUrl: "http://x" },
  );
  assertEquals(params["line_items[1][quantity]"], undefined);
});

const purchase: Purchase = {
  id: "22222222-2222-2222-2222-222222222222",
  orders: [
    { id: "a1111111-1111-1111-1111-111111111111", number: 10, storeName: "Tienda A", deliveryClass: "express", deliveryFee: "50.00", items: [{ productName: "Café", variantName: "500 g", unitPrice: "150.00", quantity: 2 }] },
    { id: "b2222222-2222-2222-2222-222222222222", number: 11, storeName: "Tienda B", deliveryClass: "programado", deliveryFee: "120.00", items: [{ productName: "Sillón", variantName: "Gris", unitPrice: "8000.00", quantity: 1 }] },
  ],
};

Deno.test("la sesión de una compra suma los pedidos, cada envío aparte, y se identifica por la compra", () => {
  const params = buildPurchaseCheckoutParams(purchase, { currency: "NIO", storeUrl: "http://127.0.0.1:3000", nowSeconds: 1000 });
  assertEquals(params.client_reference_id, purchase.id);
  assertEquals(params["metadata[checkout_id]"], purchase.id);
  assertEquals(params["metadata[order_id]"], undefined);
  assertEquals(params["payment_intent_data[metadata][checkout_id]"], purchase.id);
  assertEquals(params.success_url, `http://127.0.0.1:3000/compras/${purchase.id}?pago=ok`);
  assertEquals(params.cancel_url, `http://127.0.0.1:3000/compras/${purchase.id}?pago=cancelado`);
  assertEquals(params.expires_at, String(1000 + 31 * 60));
  assertEquals(params["line_items[0][price_data][product_data][name]"], "Café · 500 g (Tienda A)");
  assertEquals(params["line_items[1][price_data][product_data][name]"], "Envío express · Tienda A");
  assertEquals(params["line_items[2][price_data][product_data][name]"], "Sillón · Gris (Tienda B)");
  assertEquals(params["line_items[3][price_data][product_data][name]"], "Envío programado · Tienda B");

  let total = 0;
  for (let i = 0; params[`line_items[${i}][quantity]`] !== undefined; i++) {
    total += Number(params[`line_items[${i}][quantity]`]) * Number(params[`line_items[${i}][price_data][unit_amount]`]);
  }
  // 2 × 150 + 50 + 8000 + 120 = 8470.00
  assertEquals(total, 847000);
  assertEquals(purchaseTotalMinorUnits(purchase), 847000);
});

Deno.test("una compra sin costo de envío no agrega renglones de envío", () => {
  const free: Purchase = { id: purchase.id, orders: [{ ...purchase.orders[0]!, deliveryFee: 0 }] };
  const params = buildPurchaseCheckoutParams(free, { currency: "nio", storeUrl: "http://x" });
  assertEquals(params["line_items[1][quantity]"], undefined);
});

Deno.test("el evento se asigna a la compra si trae checkout_id, y al pedido si no", () => {
  const checkout = "22222222-2222-2222-2222-222222222222";
  const order = "a1111111-1111-1111-1111-111111111111";
  assertEquals(stripeEventTarget({ client_reference_id: checkout, metadata: { checkout_id: checkout } }), { kind: "checkout", id: checkout });
  assertEquals(stripeEventTarget({ client_reference_id: order, metadata: { order_id: order } }), { kind: "order", id: order });
  assertEquals(stripeEventTarget({ metadata: { order_id: order } }), { kind: "order", id: order });
  assertEquals(stripeEventTarget({ metadata: { checkout_id: "no-es-uuid" } }), null);
  assertEquals(stripeEventTarget({}), null);
});

Deno.test("el reembolso es completo sin monto y parcial con monto en centavos", () => {
  assertEquals(refundParams("pi_1", "pedido 7 cancelado"), { payment_intent: "pi_1", "metadata[motivo]": "pedido 7 cancelado" });
  assertEquals(refundParams("pi_1", "pedido 7 cancelado", null).amount, undefined);
  assertEquals(refundParams("pi_1", "pedido 7 cancelado", 7000).amount, "7000");
  assertThrows(() => refundParams("pi_1", "x", 0));
  assertThrows(() => refundParams("pi_1", "x", -5));
  assertThrows(() => refundParams("pi_1", "x", 12.5));
});
