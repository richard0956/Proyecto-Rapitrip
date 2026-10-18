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

  it("detalla qué lectura sensible fue", () => {
    expect(auditLabel("read_sensitive", { resource: "login_events" })).toBe("Consultó los inicios de sesión");
    expect(auditLabel("read_sensitive", { resource: "otra_cosa" })).toBe("Consultó información sensible");
  });

  it("muestra el código si no hay traducción", () => {
    expect(auditLabel("algo.nuevo")).toBe("algo.nuevo");
  });
});
