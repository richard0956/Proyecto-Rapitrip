import { describe, expect, it } from "vitest";
import { arrayBufferToBase64Url, pushSupport, urlBase64ToUint8Array } from "./push";

const ok = { hasServiceWorker: true, hasPushManager: true, hasNotification: true, isIos: false, isStandalone: false, hasKey: true };

describe("base64url", () => {
  it("ida y vuelta de una clave", () => {
    const text = "BEMT4SmszZqYpyohbqmizdR91mYwPLO61SIJi8TtR5n-_w";
    const bytes = urlBase64ToUint8Array(text);
    expect(arrayBufferToBase64Url(bytes.buffer)).toBe(text);
  });
  it("lee bytes conocidos", () => {
    expect(Array.from(urlBase64ToUint8Array("AAEC_w"))).toEqual([0, 1, 2, 255]);
  });
  it("un valor nulo da cadena vacía", () => {
    expect(arrayBufferToBase64Url(null)).toBe("");
  });
});

describe("pushSupport", () => {
  it("Android y escritorio: basta con el navegador", () => {
    expect(pushSupport(ok)).toEqual({ ok: true });
  });
  it("iPhone sin instalar pide añadir a la pantalla de inicio", () => {
    expect(pushSupport({ ...ok, isIos: true })).toEqual({ ok: false, reason: "instalar-ios" });
    expect(pushSupport({ ...ok, isIos: true, isStandalone: true })).toEqual({ ok: true });
  });
  it("sin las funciones del navegador no hay avisos", () => {
    expect(pushSupport({ ...ok, hasPushManager: false })).toEqual({ ok: false, reason: "no-soportado" });
    expect(pushSupport({ ...ok, hasNotification: false })).toEqual({ ok: false, reason: "no-soportado" });
  });
  it("sin clave VAPID configurada avisa que falta configuración", () => {
    expect(pushSupport({ ...ok, hasKey: false })).toEqual({ ok: false, reason: "sin-clave" });
  });
});
