import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  masterItemSchema,
  productSchema,
  variantSchema,
  stockChangeSchema,
  storeExceptionSchema,
  storeHoursSchema,
  storeSchema,
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
describe("tiendas", () => {
  it("normaliza vacíos y valida el teléfono", () => {
    expect(storeSchema.parse({ name: " Centro ", address: "", phone: "" })).toEqual({ name: "Centro", address: null, phone: null });
    expect(storeSchema.safeParse({ name: "Centro", phone: "abc" }).success).toBe(false);
    expect(storeSchema.safeParse({ name: "C" }).success).toBe(false);
  });

  it("rechaza tramos invertidos y traslapados", () => {
    expect(storeHoursSchema.safeParse([{ weekday: 1, opens: "08:00", closes: "12:00" }, { weekday: 1, opens: "13:00", closes: "18:00" }]).success).toBe(true);
    expect(storeHoursSchema.safeParse([{ weekday: 1, opens: "10:00", closes: "09:00" }]).success).toBe(false);
    expect(storeHoursSchema.safeParse([{ weekday: 1, opens: "08:00", closes: "12:00" }, { weekday: 1, opens: "11:00", closes: "14:00" }]).success).toBe(false);
    expect(storeHoursSchema.safeParse([{ weekday: 1, opens: "08:00", closes: "12:00" }, { weekday: 2, opens: "11:00", closes: "14:00" }]).success).toBe(true);
  });

  it("exige horario cuando la excepción no es un cierre", () => {
    expect(storeExceptionSchema.safeParse({ on_date: "2026-12-25", closed: true }).success).toBe(true);
    expect(storeExceptionSchema.safeParse({ on_date: "2026-12-24", closed: false }).success).toBe(false);
    expect(storeExceptionSchema.safeParse({ on_date: "2026-12-24", closed: false, opens: "08:00", closes: "12:00" }).success).toBe(true);
  });
});

describe("catálogo maestro", () => {
  it("valida clase y nombre", () => {
    expect(masterItemSchema.safeParse({ kind: "marca", name: " Marca " }).success).toBe(true);
    expect(masterItemSchema.safeParse({ kind: "otra", name: "Marca" }).success).toBe(false);
    expect(masterItemSchema.safeParse({ kind: "marca", name: "M" }).success).toBe(false);
  });
});

describe("productos", () => {
  it("normaliza vacíos y valida clasificación", () => {
    expect(productSchema.parse({ name: " Café ", description: "" })).toEqual({ name: "Café", description: null, category_id: null, brand_id: null, product_type_id: null });
    expect(productSchema.safeParse({ name: "Café", category_id: "no-uuid" }).success).toBe(false);
  });

  it("valida SKU y precio", () => {
    expect(variantSchema.safeParse({ name: "500 g", sku: "CAFE-500", price: 4500.5 }).success).toBe(true);
    expect(variantSchema.safeParse({ name: "500 g", sku: "X", price: 10 }).success).toBe(false);
    expect(variantSchema.safeParse({ name: "500 g", sku: "CAFE-500", price: -1 }).success).toBe(false);
    expect(variantSchema.safeParse({ name: "500 g", sku: "CAFE-500", price: 1.234 }).success).toBe(false);
  });
});

describe("inventario", () => {
  it("exige cantidad positiva salvo en un conteo", () => {
    expect(stockChangeSchema.safeParse({ kind: "entrada", amount: 0, reason: "compra inicial" }).success).toBe(false);
    expect(stockChangeSchema.safeParse({ kind: "conteo", amount: 0, reason: "conteo físico" }).success).toBe(true);
    expect(stockChangeSchema.safeParse({ kind: "salida", amount: 2.5, reason: "venta de mostrador" }).success).toBe(false);
    expect(stockChangeSchema.safeParse({ kind: "salida", amount: 2, reason: "abc" }).success).toBe(false);
  });
});

import { checkoutSchema, customerAddressSchema } from "./schemas";

describe("customerAddressSchema", () => {
  const base = { label: "Casa", address: "Barrio Central, casa 4" };
  it("acepta una dirección mínima y normaliza los opcionales", () => {
    const parsed = customerAddressSchema.parse({ ...base, reference: "  ", phone: "" });
    expect(parsed.reference).toBeNull();
    expect(parsed.phone).toBeNull();
    expect(parsed.make_default).toBe(false);
    expect(parsed.latitude).toBeNull();
  });
  it("exige nombre y una dirección de al menos 5 caracteres", () => {
    expect(customerAddressSchema.safeParse({ ...base, label: " " }).success).toBe(false);
    expect(customerAddressSchema.safeParse({ ...base, address: "abc" }).success).toBe(false);
    expect(customerAddressSchema.safeParse({ ...base, address: "x".repeat(241) }).success).toBe(false);
  });
  it("valida el teléfono", () => {
    expect(customerAddressSchema.safeParse({ ...base, phone: "hola" }).success).toBe(false);
    expect(customerAddressSchema.safeParse({ ...base, phone: "8888-1111" }).success).toBe(true);
  });
  it("las coordenadas reservadas para el mapa van juntas o no van", () => {
    expect(customerAddressSchema.safeParse({ ...base, latitude: 12.13 }).success).toBe(false);
    expect(customerAddressSchema.safeParse({ ...base, latitude: 12.13, longitude: -86.25 }).success).toBe(true);
    expect(customerAddressSchema.safeParse({ ...base, latitude: 120, longitude: -86.25 }).success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  const base = {
    store_id: uuid,
    items: [{ variant_id: uuid, quantity: 2 }],
    payment_method: "efectivo",
    address: "Barrio Central, casa 4",
    phone: "88881111",
    client_ref: uuid,
  };
  it("acepta un pedido válido", () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true);
  });
  it("rechaza carrito vacío, cantidades fuera de rango y métodos desconocidos", () => {
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ variant_id: uuid, quantity: 100 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ variant_id: uuid, quantity: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, payment_method: "trueque" }).success).toBe(false);
  });
  it("valida dirección, teléfono y nota", () => {
    expect(checkoutSchema.safeParse({ ...base, address: "abc" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, phone: "12" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, notes: "x".repeat(241) }).success).toBe(false);
  });
});
