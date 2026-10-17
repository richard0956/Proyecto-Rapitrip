import { describe, expect, it } from "vitest";
import { auditLabel } from "./audit-labels";

describe("auditLabel", () => {
  it("traduce acciones conocidas", () => {
    expect(auditLabel("role.suspended")).toBe("Suspendió un rol");
    expect(auditLabel("export")).toBe("Exportó datos cifrados");
  });

  it("detalla qué lectura sensible fue", () => {
    expect(auditLabel("read_sensitive", { resource: "login_events" })).toBe("Consultó los inicios de sesión");
    expect(auditLabel("read_sensitive", { resource: "otra_cosa" })).toBe("Consultó información sensible");
  });

  it("muestra el código si no hay traducción", () => {
    expect(auditLabel("algo.nuevo")).toBe("algo.nuevo");
  });
});
