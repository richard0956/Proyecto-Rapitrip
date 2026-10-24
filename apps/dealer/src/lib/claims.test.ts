import { describe, expect, it } from "vitest";
import { claimsHaveCourierRole } from "./claims";

describe("claimsHaveCourierRole", () => {
  it("reconoce el rol repartidor entre varios", () => {
    expect(claimsHaveCourierRole({ app_roles: [{ role: "cliente" }, { role: "repartidor" }] })).toBe(true);
  });
  it("otros roles no entran", () => {
    expect(claimsHaveCourierRole({ app_roles: [{ role: "admin" }] })).toBe(false);
    expect(claimsHaveCourierRole({ app_roles: [{ role: "cliente" }] })).toBe(false);
  });
  it("sin claim o con basura no entra", () => {
    expect(claimsHaveCourierRole({})).toBe(false);
    expect(claimsHaveCourierRole(null)).toBe(false);
    expect(claimsHaveCourierRole({ app_roles: "repartidor" })).toBe(false);
    expect(claimsHaveCourierRole({ app_roles: [{ role: "root" }, null] })).toBe(false);
  });
});
