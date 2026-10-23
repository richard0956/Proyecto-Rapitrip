import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  masterItemSchema,
  productDeliverySchema,
  purchaseSchema,
  deliveryGroupQuoteSchema,
  departments,
  departmentName,
  customerAddressSchema as addressSchemaForDepartment,
  deliveryLimitsSchema,
  expressLimitProblem,
  defaultExpressLimits,
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
    expect(appRoleSchema.options).toEqual(["superadmin", "admin", "cajero", "coordinador", "comercio", "cliente", "repartidor"]);
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

import { customerAddressSchema, locationSchema } from "./schemas";

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

describe("locationSchema", () => {
  it("acepta un punto completo, o ninguno para quitar la ubicación", () => {
    expect(locationSchema.parse({ latitude: 12.1364, longitude: -86.2514 })).toEqual({ latitude: 12.1364, longitude: -86.2514 });
    expect(locationSchema.parse({ latitude: null, longitude: null })).toEqual({ latitude: null, longitude: null });
    expect(locationSchema.parse({})).toEqual({ latitude: null, longitude: null });
  });
  it("rechaza un punto a medias o fuera de rango", () => {
    expect(locationSchema.safeParse({ latitude: 12.1, longitude: null }).success).toBe(false);
    expect(locationSchema.safeParse({ latitude: 95, longitude: -86 }).success).toBe(false);
  });
});

describe("productDeliverySchema", () => {
  const ok = { express_eligible: true, weight_kg: 1, length_cm: 10, width_cm: 10, height_cm: 10 };
  it("acepta un producto pequeño y normaliza lo que falta a nulo", () => {
    expect(productDeliverySchema.parse(ok)).toMatchObject({ validation_days: null });
    expect(productDeliverySchema.parse({ express_eligible: false })).toEqual({ express_eligible: false, weight_kg: null, length_cm: null, width_cm: null, height_cm: null, validation_days: null });
  });
  it("las medidas van completas o no van, y todo debe ser positivo", () => {
    expect(productDeliverySchema.safeParse({ ...ok, width_cm: null }).success).toBe(false);
    expect(productDeliverySchema.safeParse({ ...ok, weight_kg: 0 }).success).toBe(false);
    expect(productDeliverySchema.safeParse({ ...ok, height_cm: -3 }).success).toBe(false);
  });
  it("los días de validación son enteros de 0 a 60", () => {
    expect(productDeliverySchema.safeParse({ ...ok, validation_days: 61 }).success).toBe(false);
    expect(productDeliverySchema.safeParse({ ...ok, validation_days: 1.5 }).success).toBe(false);
    expect(productDeliverySchema.safeParse({ ...ok, validation_days: 14 }).success).toBe(true);
  });
});

describe("expressLimitProblem", () => {
  const small = { weight_kg: 1, length_cm: 10, width_cm: 10, height_cm: 10 };
  it("no ve problema en un producto dentro de los límites", () => {
    expect(expressLimitProblem(small, defaultExpressLimits)).toBeNull();
  });
  it("pide medidas cuando faltan", () => {
    expect(expressLimitProblem({ ...small, weight_kg: null }, defaultExpressLimits)).toMatch(/peso y las medidas/);
    expect(expressLimitProblem({ ...small, length_cm: null }, defaultExpressLimits)).toMatch(/peso y las medidas/);
  });
  it("detecta peso, lado y suma por encima del límite", () => {
    expect(expressLimitProblem({ ...small, weight_kg: 6 }, defaultExpressLimits)).toMatch(/pesa hasta 5 kg/);
    expect(expressLimitProblem({ ...small, length_cm: 50 }, defaultExpressLimits)).toMatch(/lado/);
    expect(expressLimitProblem({ weight_kg: 1, length_cm: 40, width_cm: 40, height_cm: 40 }, defaultExpressLimits)).toMatch(/suman hasta 100/);
  });
  it("acepta exactamente el límite", () => {
    expect(expressLimitProblem({ weight_kg: 5, length_cm: 45, width_cm: 45, height_cm: 10 }, defaultExpressLimits)).toBeNull();
  });
});

describe("deliveryLimitsSchema", () => {
  const base = { max_unit_kg: 5, max_side_cm: 45, max_sum_cm: 100, max_order_kg: 10 };
  it("acepta los límites por defecto", () => {
    expect(deliveryLimitsSchema.safeParse(base).success).toBe(true);
  });
  it("exige valores positivos y coherentes entre sí", () => {
    expect(deliveryLimitsSchema.safeParse({ ...base, max_unit_kg: 0 }).success).toBe(false);
    expect(deliveryLimitsSchema.safeParse({ ...base, max_order_kg: 4 }).success).toBe(false);
    expect(deliveryLimitsSchema.safeParse({ ...base, max_sum_cm: 40 }).success).toBe(false);
  });
});

describe("departamentos", () => {
  it("son 15 departamentos y 2 regiones autónomas, con código único", () => {
    expect(departments).toHaveLength(17);
    expect(new Set(departments.map((d) => d.code)).size).toBe(17);
    expect(departmentName("leon")).toBe("León");
    expect(departmentName(null)).toBe("");
  });

  it("la dirección guardada no trae departamento: lo deduce el servidor del punto del mapa", () => {
    const base = { label: "Casa", address: "Barrio Central, casa 4", latitude: 12.1364, longitude: -86.2514 };
    expect(addressSchemaForDepartment.parse({ ...base, department: "granada" })).not.toHaveProperty("department");
    expect(addressSchemaForDepartment.parse(base)).toMatchObject({ latitude: 12.1364, longitude: -86.2514 });
  });
});

describe("purchaseSchema", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const V = "00000000-0000-4000-8000-000000000001";
  const base = {
    groups: [{ store_id: A, items: [{ variant_id: V, quantity: 2 }] }],
    payment_method: "efectivo",
    address: "Barrio Central, casa 4",
    phone: "88881111",
    client_ref: A,
    latitude: 12.1364,
    longitude: -86.2514,
  };
  it("acepta una compra con una o varias tiendas y normaliza lo opcional", () => {
    expect(purchaseSchema.parse(base)).toMatchObject({ notes: null });
    expect(purchaseSchema.parse(base).groups[0]!.quote_id).toBeNull();
    const two = { ...base, groups: [...base.groups, { store_id: B, items: [{ variant_id: V, quantity: 1 }], quote_id: A }] };
    expect(purchaseSchema.safeParse(two).success).toBe(true);
  });
  it("rechaza más de 4 tiendas, tiendas repetidas y carritos vacíos", () => {
    const five = ["1", "2", "3", "4", "5"].map((n) => ({ store_id: `${n}1111111-1111-4111-8111-111111111111`, items: [{ variant_id: V, quantity: 1 }] }));
    expect(purchaseSchema.safeParse({ ...base, groups: five }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...base, groups: [base.groups[0], base.groups[0]] }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...base, groups: [] }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...base, groups: [{ store_id: A, items: [] }] }).success).toBe(false);
  });
  it("exige pin, teléfono y dirección, y no acepta un departamento del cliente", () => {
    expect(purchaseSchema.safeParse({ ...base, latitude: undefined }).success).toBe(false);
    expect(purchaseSchema.parse({ ...base, department: "granada" })).not.toHaveProperty("department");
    expect(purchaseSchema.safeParse({ ...base, phone: "12" }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...base, address: "abc" }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...base, payment_method: "trueque" }).success).toBe(false);
  });
  it("la cotización por grupo pide tienda, productos y punto", () => {
    const q = { store_id: A, items: [{ variant_id: V, quantity: 1 }], latitude: 12.1, longitude: -86.2 };
    expect(deliveryGroupQuoteSchema.safeParse(q).success).toBe(true);
    expect(deliveryGroupQuoteSchema.safeParse({ ...q, latitude: undefined }).success).toBe(false);
  });
});
