import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  appRoleSchema,
  commerceRequestSchema,
  consoleRoles,
  courierSchema,
  emailSchema,
  exportRequestSchema,
  inviteStaffSchema,
  passwordSchema,
  phoneSchema,
  reasonSchema,
} from "./schemas";

describe("passwordSchema", () => {
  it("exige entre 8 y 72 caracteres", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(73)).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("normaliza a minúsculas y recorta espacios", () => {
    expect(emailSchema.parse("  Ana@X.COM ")).toBe("ana@x.com");
    expect(emailSchema.safeParse("sin-arroba").success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("acepta formatos locales y rechaza letras", () => {
    expect(phoneSchema.safeParse("8888-1234").success).toBe(true);
    expect(phoneSchema.safeParse("+505 8888 1234").success).toBe(true);
    expect(phoneSchema.safeParse("abc").success).toBe(false);
  });
});

describe("roles", () => {
  it("son exactamente los seis del spec", () => {
    expect(appRoleSchema.options).toEqual(["superadmin", "admin", "cajero", "coordinador", "comercio", "cliente"]);
  });
  it("los roles de consola no incluyen al cliente", () => {
    expect(consoleRoles).toEqual(["superadmin", "admin", "cajero", "coordinador", "comercio"]);
  });
});

describe("inviteStaffSchema", () => {
  it("solo admite admin, cajero y coordinador", () => {
    expect(inviteStaffSchema.safeParse({ email: "a@x.com", role: "cajero" }).success).toBe(true);
    expect(inviteStaffSchema.safeParse({ email: "a@x.com", role: "comercio" }).success).toBe(false);
    expect(inviteStaffSchema.safeParse({ email: "a@x.com", role: "superadmin" }).success).toBe(false);
  });
});

describe("acceptInvitationSchema", () => {
  it("valida el largo del token y la contraseña opcional", () => {
    const token = "a".repeat(43);
    expect(acceptInvitationSchema.safeParse({ token }).success).toBe(true);
    expect(acceptInvitationSchema.safeParse({ token, password: "corta" }).success).toBe(false);
    expect(acceptInvitationSchema.safeParse({ token: "corto" }).success).toBe(false);
  });
});

describe("reasonSchema y exportRequestSchema", () => {
  it("el motivo común exige 5 caracteres y el de exportación 10", () => {
    expect(reasonSchema.safeParse("abcd").success).toBe(false);
    expect(reasonSchema.safeParse("abcde").success).toBe(true);
    expect(exportRequestSchema.safeParse({ dataset: "accounts", reason: "corto" }).success).toBe(false);
    expect(exportRequestSchema.safeParse({ dataset: "accounts", reason: "auditoría anual" }).success).toBe(true);
    expect(exportRequestSchema.safeParse({ dataset: "clientes", reason: "auditoría anual" }).success).toBe(false);
  });
});

describe("commerceRequestSchema y courierSchema", () => {
  it("validan nombre de negocio y ficha de repartidor", () => {
    expect(commerceRequestSchema.safeParse({ business_name: "T" }).success).toBe(false);
    expect(commerceRequestSchema.parse({ business_name: "Tienda Uno" }).details).toEqual({});
    expect(courierSchema.safeParse({ full_name: "Rep Uno", phone: "88887777", vehicle_type: "moto" }).success).toBe(true);
    expect(courierSchema.safeParse({ full_name: "Rep Uno", phone: "abc", vehicle_type: "moto" }).success).toBe(false);
  });
});