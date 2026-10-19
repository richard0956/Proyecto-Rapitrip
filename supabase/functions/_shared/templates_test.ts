/// <reference lib="deno.ns" />

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { escapeHtml, renderEmail } from "./templates.ts";
 
Deno.test("escapeHtml neutraliza etiquetas y comillas", () => {
  assertEquals(escapeHtml(`<script>"x"&'y'</script>`), "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
});

Deno.test("commerce_approved escapa el nombre del negocio", () => {
  const m = renderEmail("commerce_approved", { business_name: "<b>Tienda</b>", console_url: "https://consola.test" });
  assertStringIncludes(m.html, "&lt;b&gt;Tienda&lt;/b&gt;");
  assertEquals(m.html.includes("<b>Tienda</b>"), false);
  assertStringIncludes(m.text, "https://consola.test");
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
