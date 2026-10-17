import { describe, expect, it } from "vitest";
import { decideConsoleAccess, homePathForRole, roleFromClaims } from "./roles";

describe("roles", () => {
  it("lee el rol del claim y rechaza valores desconocidos", () => {
    expect(roleFromClaims({ app_role: "admin" })).toBe("admin");
    expect(roleFromClaims({ app_role: "root" })).toBeNull();
    expect(roleFromClaims(null)).toBeNull();
  });

  it("mapea rol a ruta de inicio", () => {
    expect(homePathForRole("superadmin")).toBe("/admin");
    expect(homePathForRole("cajero")).toBe("/operations");
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
});
