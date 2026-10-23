import { describe, expect, it } from "vitest";
import { formatCountdown, offerLabel, openOffer, secondsLeft, type OfferInfo } from "./offers";

const now = Date.parse("2026-10-23T12:00:00Z");
const offer = (over: Partial<OfferInfo>): OfferInfo => ({ id: "o", courierName: "Ana", status: "pendiente", expiresAt: "2026-10-23T12:02:00Z", respondedAt: null, rejectReason: null, ...over });

describe("openOffer", () => {
  it("devuelve la pendiente con tiempo y sus segundos", () => {
    expect(openOffer([offer({})], now)).toMatchObject({ id: "o", secondsLeft: 120 });
  });
  it("una pendiente cuyo plazo ya pasó no cuenta como abierta (el reloj tarda hasta un minuto en marcarla)", () => {
    expect(openOffer([offer({ expiresAt: "2026-10-23T11:59:00Z" })], now)).toBeNull();
  });
  it("las ya resueltas no cuentan", () => {
    expect(openOffer([offer({ status: "rechazada" }), offer({ status: "aceptada" })], now)).toBeNull();
  });
});

describe("offerLabel", () => {
  it("dice cómo terminó y qué hacer", () => {
    expect(offerLabel(offer({ status: "rechazada", rejectReason: "Estoy muy lejos" }))).toBe("Ana la rechazó: «Estoy muy lejos». Propónsela a otro.");
    expect(offerLabel(offer({ status: "rechazada" }))).toBe("Ana la rechazó. Propónsela a otro.");
    expect(offerLabel(offer({ status: "vencida" }))).toMatch(/no respondió/);
    expect(offerLabel(offer({ status: "aceptada" }))).toBe("Ana la aceptó.");
    expect(offerLabel(offer({ status: "cancelada" }))).toMatch(/Se retiró/);
  });
});

describe("tiempos", () => {
  it("segundos restantes nunca negativos y fechas malas dan cero", () => {
    expect(secondsLeft("2026-10-23T11:00:00Z", now)).toBe(0);
    expect(secondsLeft("no es fecha", now)).toBe(0);
  });
  it("formatea m:ss", () => {
    expect(formatCountdown(125)).toBe("2:05");
    expect(formatCountdown(-3)).toBe("0:00");
  });
});
