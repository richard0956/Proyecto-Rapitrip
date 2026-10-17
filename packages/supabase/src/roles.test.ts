import { describe, expect, it } from "vitest";
import { canManageRole, decideConsoleAccess, homePathForRole, invitableRoles, roleFromClaims } from "./roles";

describe("roles", () => {
  it("lee el rol del claim y rechaza valores desconocidos", () => {
    expect(roleFromClaims({ app_roles: [{ role: "admin", commerce_id: null }] })).toBe("admin");
    expect(roleFromClaims({ app_roles: [{ role: "root" }] })).toBeNull();
    expect(roleFromClaims({ app_roles: [] })).toBeNull();
    expect(roleFromClaims({})).toBeNull();
    expect(roleFromClaims(null)).toBeNull();
  });

  it("elige el rol de mayor prioridad", () => {
    expect(roleFromClaims({ app_roles: [{ role: "cliente" }, { role: "admin" }, { role: "cajero" }] })).toBe("admin");
  });

  it("mapea rol a ruta de inicio", () => {
    expect(homePathForRole("superadmin")).toBe("/admin");
    expect(homePathForRole("cajero")).toBe("/caja");
    expect(homePathForRole("coordinador")).toBe("/coordinacion");
    expect(homePathForRole("comercio")).toBe("/comercio");
    expect(homePathForRole("cliente")).toBe("/sin-acceso");
    expect(homePathForRole(null)).toBe("/sin-acceso");
  });

  it("decide el acceso a la consola", () => {
    const base = { signedIn: true, role: "admin", aal: "aal2", area: "admin" } as const;
    expect(decideConsoleAccess(base)).toEqual({ kind: "allow" });
    expect(decideConsoleAccess({ ...base, signedIn: false })).toEqual({ kind: "redirect", to: "/login" });
    expect(decideConsoleAccess({ ...base, aal: "aal1" })).toEqual({ kind: "redirect", to: "/mfa" });
    expect(decideConsoleAccess({ ...base, role: "cliente" })).toEqual({ kind: "redirect", to: "/sin-acceso" });
    expect(decideConsoleAccess({ ...base, role: "cajero" })).toEqual({ kind: "redirect", to: "/sin-acceso" });
  });

  it("cajero y coordinador no ven el área del otro", () => {
    const base = { signedIn: true, aal: "aal2" } as const;
    expect(decideConsoleAccess({ ...base, role: "cajero", area: "caja" })).toEqual({ kind: "allow" });
    expect(decideConsoleAccess({ ...base, role: "cajero", area: "coordinacion" })).toEqual({ kind: "redirect", to: "/sin-acceso" });
    expect(decideConsoleAccess({ ...base, role: "coordinador", area: "coordinacion" })).toEqual({ kind: "allow" });
    expect(decideConsoleAccess({ ...base, role: "coordinador", area: "caja" })).toEqual({ kind: "redirect", to: "/sin-acceso" });
  });
});

describe("gestión de roles", () => {
  it("replica la matriz del backend", () => {
    expect(canManageRole("superadmin", "admin")).toBe(true);
    expect(canManageRole("admin", "admin")).toBe(false);
    expect(canManageRole("admin", "cajero")).toBe(true);
    expect(canManageRole("cajero", "cliente")).toBe(false);
    expect(canManageRole("admin", "superadmin")).toBe(false);
    expect(canManageRole(null, "cajero")).toBe(false);
  });

  it("lista los roles invitables según quien invita", () => {
    expect(invitableRoles("superadmin")).toEqual(["admin", "cajero", "coordinador"]);
    expect(invitableRoles("admin")).toEqual(["cajero", "coordinador"]);
    expect(invitableRoles("comercio")).toEqual([]);
  });
});
