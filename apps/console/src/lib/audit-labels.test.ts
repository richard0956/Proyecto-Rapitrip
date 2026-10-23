import { describe, expect, it } from "vitest";
import { auditLabel } from "./audit-labels";

describe("auditLabel", () => {
  it("traduce acciones conocidas", () => {
    expect(auditLabel("role.suspended")).toBe("Suspendió un rol");
    expect(auditLabel("export")).toBe("Exportó datos cifrados");
  });

  it("traduce las acciones de la Fase 2", () => {
    expect(auditLabel("store.hours_changed")).toBe("Cambió el horario de una tienda");
    expect(auditLabel("inventory.conteo")).toBe("Registró un conteo de stock");
    expect(auditLabel("commerce.status_changed")).toBe("Cambió el estado de un comercio");
  });

  it("traduce las acciones de pedidos y pagos", () => {
    expect(auditLabel("order.paid")).toBe("Recibió el pago de un pedido");
    expect(auditLabel("order.refunded")).toBe("Reembolsó un pedido");
    expect(auditLabel("order.en_camino")).toBe("Despachó un pedido");
  });

  it("traduce las acciones de entregas express y programadas", () => {
    expect(auditLabel("product.delivery_changed")).toBe("Cambió el tipo de entrega de un producto");
    expect(auditLabel("delivery_class.limits_changed")).toBe("Cambió los límites de la entrega express");
    expect(auditLabel("checkout.created")).toBe("Creó una compra con varios pedidos");
  });

  it("traduce la validación y la reclasificación de pedidos", () => {
    expect(auditLabel("order.en_validacion")).toBe("Empezó a validar un pedido programado");
    expect(auditLabel("order.reclassified")).toBe("Pasó un pedido express a programado");
  });

  it("traduce la acción de quitar un descuento", () => {
    expect(auditLabel("variant.discount_removed")).toBe("Quitó el descuento de una variante");
  });

  it("detalla qué lectura sensible fue", () => {
    expect(auditLabel("read_sensitive", { resource: "login_events" })).toBe("Consultó los inicios de sesión");
    expect(auditLabel("read_sensitive", { resource: "otra_cosa" })).toBe("Consultó información sensible");
  });

  it("muestra el código si no hay traducción", () => {
    expect(auditLabel("algo.nuevo")).toBe("algo.nuevo");
  });
});
