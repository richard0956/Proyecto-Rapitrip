/// <reference lib="deno.ns" />

import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { InvalidPhoneError, normalizeNicaraguaPhone, sendWhatsApp } from "./ultramsg.ts";
import { renderWhatsApp } from "./whatsapp_templates.ts";

Deno.test("normaliza teléfonos de Nicaragua a +505", () => {
  for (const raw of ["8888-1234", "88881234", "+505 8888 1234", "(505) 88881234", "00505 8888-1234", "505-2222-3333"]) {
    assert(normalizeNicaraguaPhone(raw)?.startsWith("+505"), raw);
  }
  assertEquals(normalizeNicaraguaPhone("8888-1234"), "+50588881234");
  assertEquals(normalizeNicaraguaPhone("+505 2222 3333"), "+50522223333");
});

Deno.test("rechaza teléfonos que no son de Nicaragua", () => {
  for (const raw of ["", "abc", "1234567", "9888 1234", "+1 305 555 0123", "+505 888 123", "8888 1234 5", null, undefined, 42]) {
    assertEquals(normalizeNicaraguaPhone(raw), null, String(raw));
  }
});

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, Deno.env.get(k)]));
  for (const [k, v] of Object.entries(vars)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  return fn().finally(() => {
    for (const [k, v] of Object.entries(before)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  });
}

Deno.test("sendWhatsApp llama a la instancia con token, to y body", () =>
  withEnv({ ULTRAMSG_INSTANCE_ID: "instance123", ULTRAMSG_TOKEN: "tok" }, async () => {
    let url = "";
    let sent = "";
    const fake = ((input: string, init: RequestInit) => {
      url = input;
      sent = String(init.body);
      return Promise.resolve(new Response(JSON.stringify({ sent: "true", message: "ok", id: 1 })));
    }) as unknown as typeof fetch;
    await sendWhatsApp({ to: "8888-1234", body: "Hola ñandú" }, fake);
    assertEquals(url, "https://api.ultramsg.com/instance123/messages/chat");
    const form = new URLSearchParams(sent);
    assertEquals(form.get("token"), "tok");
    assertEquals(form.get("to"), "+50588881234");
    assertEquals(form.get("body"), "Hola ñandú");
  }));

Deno.test("sendWhatsApp con número inválido no llama a la red", () =>
  withEnv({ ULTRAMSG_INSTANCE_ID: "i", ULTRAMSG_TOKEN: "t" }, async () => {
    let called = false;
    const fake = (() => {
      called = true;
      return Promise.resolve(new Response("{}"));
    }) as unknown as typeof fetch;
    await assertRejects(() => sendWhatsApp({ to: "123", body: "x" }, fake), InvalidPhoneError);
    assertEquals(called, false);
  }));

Deno.test("sendWhatsApp falla sin credenciales y no filtra el token al error", async () => {
  await withEnv({ ULTRAMSG_INSTANCE_ID: undefined, ULTRAMSG_TOKEN: undefined }, async () => {
    await assertRejects(() => sendWhatsApp({ to: "88881234", body: "x" }), Error, "ULTRAMSG_INSTANCE_ID");
  });
  await withEnv({ ULTRAMSG_INSTANCE_ID: "i", ULTRAMSG_TOKEN: "secreto-super" }, async () => {
    const fake = (() => Promise.resolve(new Response(JSON.stringify({ error: "instancia detenida" }), { status: 200 }))) as unknown as typeof fetch;
    const err = await assertRejects(() => sendWhatsApp({ to: "88881234", body: "x" }, fake), Error, "instancia detenida");
    assertEquals(err.message.includes("secreto-super"), false);
    const fake500 = (() => Promise.resolve(new Response("boom", { status: 500 }))) as unknown as typeof fetch;
    await assertRejects(() => sendWhatsApp({ to: "88881234", body: "x" }, fake500), Error, "500");
  });
});

Deno.test("la plantilla de afiliación es formal y no promete plazos", () => {
  const text = renderWhatsApp("commerce_request_received", { contact_name: "Ana Pérez", business_name: "Café Norte" });
  assertStringIncludes(text, "Estimado(a) Ana Pérez");
  assertStringIncludes(text, "Gracias por confiar en Rapitrip");
  assertStringIncludes(text, "Café Norte");
  assertStringIncludes(text, "se pondrá en contacto con usted");
  assertEquals(/\b(horas?|días?|24|48|72|inmediat)/i.test(text), false);
  assertStringIncludes(renderWhatsApp("commerce_request_received", {}), "Estimado(a) solicitante");
});
