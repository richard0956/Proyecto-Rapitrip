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