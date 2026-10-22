import { describe, expect, it } from "vitest";
import { awaitingPaymentConfirmation, customerCanCancel, isFinalStatus, isOrderStatus, progressIndex, remainingText } from "./orders";

describe("orders", () => {
  it("el cliente solo cancela antes de que el comercio acepte", () => {
    expect(customerCanCancel("pendiente_pago")).toBe(true);
    expect(customerCanCancel("por_confirmar")).toBe(true);
    expect(customerCanCancel("en_validacion")).toBe(true);
    expect(customerCanCancel("confirmado")).toBe(false);
    expect(customerCanCancel("entregado")).toBe(false);
  });
  it("reconoce estados finales y válidos", () => {
    expect(isFinalStatus("cancelado")).toBe(true);
    expect(isFinalStatus("en_camino")).toBe(false);
    expect(isOrderStatus("por_confirmar")).toBe(true);
    expect(isOrderStatus("en_validacion")).toBe(true);
    expect(isOrderStatus("otro")).toBe(false);
  });
  it("calcula el avance", () => {
    expect(progressIndex("pendiente_pago")).toBe(-1);
    expect(progressIndex("por_confirmar")).toBe(0);
    expect(progressIndex("en_validacion")).toBe(0);
    expect(progressIndex("entregado")).toBe(5);
    expect(progressIndex("cancelado")).toBe(-1);
  });
  it("el tiempo restante usa minutos redondeados hacia arriba y desaparece al vencer", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    expect(remainingText("2026-10-18T12:10:30Z", now)).toBe("11 min");
    expect(remainingText("2026-10-18T12:00:45Z", now)).toBe("45 s");
    expect(remainingText("2026-10-18T11:59:00Z", now)).toBeNull();
    expect(remainingText(null, now)).toBeNull();
  });
  it("no afirma «pagado» por la URL: solo detecta que falta la confirmación del webhook", () => {
    expect(awaitingPaymentConfirmation("ok", "pendiente_pago")).toBe(true);
    expect(awaitingPaymentConfirmation("ok", "por_confirmar")).toBe(false);
    expect(awaitingPaymentConfirmation("cancelado", "pendiente_pago")).toBe(false);
    expect(awaitingPaymentConfirmation(undefined, "pendiente_pago")).toBe(false);
  });
});

describe("remainingText con plazos largos", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
  it("sigue en minutos hasta dos horas", () => {
    expect(remainingText(at(45), now)).toBe("45 min");
    expect(remainingText(at(120), now)).toBe("120 min");
  });
  it("pasa a horas y a días para los pedidos programados", () => {
    expect(remainingText(at(24 * 60), now)).toBe("24 h");
    expect(remainingText(at(47 * 60 + 30), now)).toBe("48 h");
    expect(remainingText(at(72 * 60), now)).toBe("3 días");
  });
  it("devuelve nulo si ya venció", () => {
    expect(remainingText(at(-5), now)).toBeNull();
  });
});
