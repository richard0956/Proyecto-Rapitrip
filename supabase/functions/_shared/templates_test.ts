/// <reference lib="deno.ns" />

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { escapeHtml, renderEmail } from "./templates.ts";
 
Deno.test("escapeHtml neutraliza etiquetas y comillas", () => {
  assertEquals(escapeHtml(`<script>"x"&'y'</script>`), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
});

Deno.test("commerce_approved escapa el nombre del negocio y dice a qué correo llegó la invitación", () => {
  const m = renderEmail("commerce_approved", { business_name: "<b>Tienda</b>", console_email: "negocio@correo.test" });
  assertStringIncludes(m.html, "&lt;b&gt;Tienda&lt;/b&gt;");
  assertEquals(m.html.includes("<b>Tienda</b>"), false);
  assertStringIncludes(m.text, "negocio@correo.test");
});

Deno.test("commerce_rejected incluye el motivo", () => {
  const m = renderEmail("commerce_rejected", { business_name: "Tienda", reason: "Falta el convenio firmado" });
  assertStringIncludes(m.text, "Falta el convenio firmado");
});

Deno.test("incident_alert indica gravedad y descripción", () => {
  const m = renderEmail("incident_alert", { severity: "alta", description: "Intentos fallidos repetidos" });
  assertStringIncludes(m.subject, "alta");
  assertStringIncludes(m.text, "Intentos fallidos repetidos");
});

Deno.test("invitation incluye el enlace y el rol legible", () => {
  const m = renderEmail("invitation", {
    link: "https://consola.test/aceptar-invitacion?token=abc", role: "coordinador", expiresAt: "2026-11-05T12:00:00Z",
  });
  assertStringIncludes(m.html, "https://consola.test/aceptar-invitacion?token=abc");
  assertStringIncludes(m.text, "Coordinador de pedidos");
});

Deno.test("invitation de repartidor usa su propio asunto y rol", () => {
  const m = renderEmail("invitation", {
    link: "https://repartidor.test/aceptar-invitacion?token=abc", role: "repartidor", expiresAt: "2026-11-05T12:00:00Z",
  });
  assertStringIncludes(m.subject, "repartidor");
  assertStringIncludes(m.text, "Repartidor");
  assertStringIncludes(m.html, "https://repartidor.test/aceptar-invitacion?token=abc");
});

Deno.test("una plantilla desconocida lanza error", () => {
  let failed = false;
  try { renderEmail("no_existe" as never, {}); } catch { failed = true; }
  assertEquals(failed, true);
});

Deno.test("order_received incluye número, tienda, total y enlace al pedido", () => {
  const m = renderEmail("order_received", {
    number: 1042, store_name: "Tienda <A>", total: 446, order_id: "abc", store_url: "https://tienda.test/",
  });
  assertStringIncludes(m.subject, "1042");
  assertStringIncludes(m.html, "Tienda &lt;A&gt;");
  assertStringIncludes(m.text, "C$ 446.00");
  assertStringIncludes(m.text, "https://tienda.test/pedidos/abc");
});

Deno.test("order_cancelled distingue rechazado y menciona el reembolso solo con tarjeta", () => {
  const rechazado = renderEmail("order_cancelled", { number: 7, store_name: "T", status: "rechazado", reason: "Sin stock", payment_method: "efectivo" });
  assertStringIncludes(rechazado.subject, "rechazado");
  assertStringIncludes(rechazado.text, "Sin stock");
  assertEquals(rechazado.text.includes("reembolso"), false);
  const tarjeta = renderEmail("order_cancelled", { number: 8, store_name: "T", status: "cancelado", payment_method: "tarjeta" });
  assertStringIncludes(tarjeta.subject, "cancelado");
  assertStringIncludes(tarjeta.text, "reembolso");
});

Deno.test("order_received lista las facturas emitidas y aclara que no tienen validez fiscal", () => {
  const m = renderEmail("order_received", {
    number: 88, store_name: "Tienda", total: 230, order_id: "abc", store_url: "https://tienda.test",
    invoices: [{ kind: "venta", number: "RT-V-000123" }, { kind: "servicio", number: "RT-S-000123" }],
  });
  assertStringIncludes(m.text, "factura de venta RT-V-000123 y factura de servicio RT-S-000123");
  assertStringIncludes(m.text, "sin validez fiscal");
  assertStringIncludes(m.html, "<strong>RT-S-000123</strong>");
  assertStringIncludes(m.html, "descargarlas en PDF");
});

Deno.test("order_received sin facturas sale como antes, y datos raros se ignoran y se escapan", () => {
  const sin = renderEmail("order_received", { number: 1, store_name: "T", total: 1 });
  assertEquals(sin.text.includes("factura"), false);
  const raro = renderEmail("order_received", { number: 1, store_name: "T", total: 1, invoices: [{ kind: "venta" }, null, "x", { kind: "venta", number: "<b>RT</b>" }] });
  assertStringIncludes(raro.html, "&lt;b&gt;RT&lt;/b&gt;");
  assertEquals(raro.html.includes("<b>RT</b>"), false);
});

Deno.test("order_cancelled menciona las notas de crédito cuando las hay", () => {
  const m = renderEmail("order_cancelled", { number: 8, store_name: "T", status: "cancelado", payment_method: "efectivo", credit_notes: [{ kind: "nota_credito_venta", number: "RT-NCV-000045" }] });
  assertStringIncludes(m.text, "nota de crédito de venta RT-NCV-000045");
  assertStringIncludes(m.html, "RT-NCV-000045");
  assertEquals(renderEmail("order_cancelled", { number: 9, store_name: "T", status: "cancelado", credit_notes: [] }).text.includes("Anulamos"), false);
});
