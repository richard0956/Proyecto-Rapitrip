import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("correo inválido");
export const passwordSchema = z
  .string()
  .min(8, "mínimo 8 caracteres")
  .max(72, "máximo 72 caracteres");
export const phoneSchema = z.string().regex(/^[0-9+() -]{8,20}$/, "teléfono inválido");
export const fullNameSchema = z.string().trim().min(2, "mínimo 2 caracteres").max(120, "máximo 120 caracteres");
export const reasonSchema = z.string().trim().min(5, "el motivo exige al menos 5 caracteres").max(500);
export const strongReasonSchema = z.string().trim().min(10, "el motivo exige al menos 10 caracteres").max(500);

export const appRoleSchema = z.enum(["superadmin", "admin", "cajero", "coordinador", "comercio", "cliente"]);
export type AppRole = z.infer<typeof appRoleSchema>;

/** Roles que exigen contraseña, segundo factor y sesión de consola. */
export const consoleRoles = ["superadmin", "admin", "cajero", "coordinador", "comercio"] as const satisfies readonly AppRole[];

export const staffRoleSchema = z.enum(["admin", "cajero", "coordinador"]);

export const inviteStaffSchema = z.object({ email: emailSchema, role: staffRoleSchema });

export const acceptInvitationSchema = z.object({
  token: z.string().min(40).max(64),
  password: passwordSchema.optional(),
  full_name: fullNameSchema.optional(),
});

export const commerceRequestSchema = z.object({
  business_name: z.string().trim().min(2).max(150),
  details: z.record(z.unknown()).default({}),
});

export const courierSchema = z.object({
  full_name: fullNameSchema,
  phone: phoneSchema,
  vehicle_type: z.string().trim().min(2).max(60),
  document_path: z.string().regex(/^[A-Za-z0-9/_.-]{1,300}$/).optional(),
});

export const exportRequestSchema = z.object({
  dataset: z.enum(["audit", "login_events", "accounts", "couriers"]),
  reason: strongReasonSchema,
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
/** Tiendas de un comercio (Fase 2). Los mismos límites que valida la base de datos. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `máximo ${max} caracteres`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

export const storeSchema = z.object({
  name: z.string().trim().min(2, "mínimo 2 caracteres").max(80, "máximo 80 caracteres"),
  address: optionalText(240),
  phone: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null)
    .refine((value) => value === null || /^[0-9+() -]{8,20}$/.test(value), "teléfono inválido"),
});
export type StoreInput = z.infer<typeof storeSchema>;

/** Pin del mapa: latitud y longitud juntas o ninguna. La base de datos exige además que el punto caiga dentro de Nicaragua. */
const pinFields = {
  latitude: z.number().min(-90).max(90).nullable().optional().transform((value) => value ?? null),
  longitude: z.number().min(-180).max(180).nullable().optional().transform((value) => value ?? null),
};
const pinIsComplete = (value: { latitude: number | null; longitude: number | null }) => (value.latitude === null) === (value.longitude === null);

export const locationSchema = z.object(pinFields).refine(pinIsComplete, { message: "la ubicación va completa o no va", path: ["latitude"] });
export type LocationInput = z.infer<typeof locationSchema>;

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "hora inválida (usa HH:MM)");

export const hoursRangeSchema = z
  .object({ weekday: z.number().int().min(0).max(6), opens: timeSchema, closes: timeSchema })
  .refine((range) => range.opens < range.closes, "la apertura debe ser antes del cierre");
export type HoursRange = z.infer<typeof hoursRangeSchema>;

/** Horario semanal completo. Los tramos de un mismo día no pueden traslaparse. */
export const storeHoursSchema = z
  .array(hoursRangeSchema)
  .max(42, "demasiados tramos")
  .superRefine((ranges, ctx) => {
    for (let a = 0; a < ranges.length; a++) {
      for (let b = a + 1; b < ranges.length; b++) {
        const x = ranges[a]!;
        const y = ranges[b]!;
        if (x.weekday === y.weekday && x.opens < y.closes && y.opens < x.closes) {
          ctx.addIssue({ code: "custom", message: "hay tramos que se traslapan en un mismo día" });
          return;
        }
      }
    }
  });

export const storeExceptionSchema = z
  .object({
    on_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha inválida"),
    closed: z.boolean(),
    opens: timeSchema.optional(),
    closes: timeSchema.optional(),
    note: optionalText(120),
  })
  .refine((value) => value.closed || (value.opens !== undefined && value.closes !== undefined && value.opens < value.closes), "indica apertura y cierre, con la apertura antes del cierre");

export const temporaryClosureSchema = z.object({
  /** Fecha y hora local de Nicaragua (formato de `datetime-local`). */
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "fecha inválida"),
  reason: optionalText(200),
});

/** Catálogo maestro (orientativo): clases de elementos y sus reglas. */
export const masterKindSchema = z.enum(["categoria", "marca", "tipo_producto", "atributo"]);
export type MasterKind = z.infer<typeof masterKindSchema>;
export const masterItemSchema = z.object({
  kind: masterKindSchema,
  name: z.string().trim().min(2, "mínimo 2 caracteres").max(80, "máximo 80 caracteres"),
  parent_id: z.string().uuid().nullable().optional(),
});

/** Productos, variantes e imágenes (Fase 2). Mismos límites que valida la base de datos. */
const uuidOrNull = z
  .string()
  .nullable()
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, "elemento inválido");

export const productSchema = z.object({
  name: z.string().trim().min(2, "mínimo 2 caracteres").max(120, "máximo 120 caracteres"),
  description: z
    .string()
    .trim()
    .max(1000, "máximo 1000 caracteres")
    .optional()
    .transform((value) => (value ? value : null)),
  category_id: uuidOrNull,
  brand_id: uuidOrNull,
  product_type_id: uuidOrNull,
});
export type ProductInput = z.infer<typeof productSchema>;

/** Límites de la entrega express (los vigentes los fija la administración; la base de datos vuelve a validarlos). */
export type ExpressLimits = { max_unit_kg: number; max_side_cm: number; max_sum_cm: number; max_order_kg: number };
export const defaultExpressLimits: ExpressLimits = { max_unit_kg: 5, max_side_cm: 45, max_sum_cm: 100, max_order_kg: 10 };

const optionalPositive = (message: string) =>
  z
    .number({ invalid_type_error: message })
    .positive(message)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

/** Peso, medidas y tipo de entrega de un producto: solo puede ser express si cabe en una moto. */
export const productDeliverySchema = z
  .object({
    express_eligible: z.boolean(),
    weight_kg: optionalPositive("el peso debe ser mayor que cero").refine((value) => value === null || value <= 9999, "peso demasiado alto"),
    length_cm: optionalPositive("el largo debe ser mayor que cero"),
    width_cm: optionalPositive("el ancho debe ser mayor que cero"),
    height_cm: optionalPositive("el alto debe ser mayor que cero"),
    validation_days: z
      .number({ invalid_type_error: "los días de validación son un número entero" })
      .int("los días de validación son un número entero")
      .min(0, "los días de validación van de 0 a 60")
      .max(60, "los días de validación van de 0 a 60")
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .superRefine((value, ctx) => {
    const dims = [value.length_cm, value.width_cm, value.height_cm];
    if (dims.some((d) => d === null) && dims.some((d) => d !== null)) {
      ctx.addIssue({ code: "custom", path: ["length_cm"], message: "las medidas van completas (largo, ancho y alto) o no van" });
    }
  });
export type ProductDeliveryInput = z.infer<typeof productDeliverySchema>;

/** Motivo por el que un producto no puede ser express con esos límites; nulo si cumple. Misma regla que `set_product_delivery`. */
export function expressLimitProblem(
  product: { weight_kg: number | null; length_cm: number | null; width_cm: number | null; height_cm: number | null },
  limits: ExpressLimits,
): string | null {
  if (product.weight_kg === null || product.length_cm === null || product.width_cm === null || product.height_cm === null) {
    return "Para entregar como express indica el peso y las medidas del producto.";
  }
  if (product.weight_kg > limits.max_unit_kg) return `Un producto express pesa hasta ${limits.max_unit_kg} kg.`;
  const side = Math.max(product.length_cm, product.width_cm, product.height_cm);
  if (side > limits.max_side_cm) return `Un producto express mide hasta ${limits.max_side_cm} cm de lado.`;
  if (product.length_cm + product.width_cm + product.height_cm > limits.max_sum_cm) {
    return `Largo, ancho y alto de un producto express suman hasta ${limits.max_sum_cm} cm.`;
  }
  return null;
}

/** Límites de express que edita la administración. */
const positiveLimit = (label: string) => z.number({ invalid_type_error: `${label}: escribe un número` }).positive(`${label}: debe ser mayor que cero`).max(100000, `${label}: demasiado alto`);
export const deliveryLimitsSchema = z
  .object({
    max_unit_kg: positiveLimit("Peso por unidad"),
    max_side_cm: positiveLimit("Lado más largo"),
    max_sum_cm: positiveLimit("Largo + ancho + alto"),
    max_order_kg: positiveLimit("Peso por pedido"),
  })
  .superRefine((value, ctx) => {
    if (value.max_order_kg < value.max_unit_kg) ctx.addIssue({ code: "custom", path: ["max_order_kg"], message: "El peso por pedido no puede ser menor que el de una unidad." });
    if (value.max_sum_cm < value.max_side_cm) ctx.addIssue({ code: "custom", path: ["max_sum_cm"], message: "La suma de medidas no puede ser menor que el lado más largo." });
  });
export type DeliveryLimitsInput = z.infer<typeof deliveryLimitsSchema>;

export const skuSchema = z.string().trim().regex(/^[A-Za-z0-9._-]{2,40}$/, "el SKU admite letras, números, punto, guion y guion bajo (2 a 40)");
export const variantSchema = z.object({
  name: z.string().trim().min(1, "escribe el nombre de la variante").max(80, "máximo 80 caracteres"),
  sku: skuSchema,
  price: z.number({ invalid_type_error: "precio inválido", required_error: "precio inválido" }).min(0, "el precio no puede ser negativo").lt(100_000_000, "precio demasiado alto").multipleOf(0.01, "usa hasta dos decimales"),
});
export type VariantInput = z.infer<typeof variantSchema>;

export const productImageRules = { maxCount: 5, maxBytes: 2 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] as const };

/** Inventario (Fase 2): control de stock y movimientos manuales con motivo. */
const stockInt = z.number({ invalid_type_error: "cantidad inválida", required_error: "cantidad inválida" }).int("usa un número entero").min(0, "no puede ser negativa").max(999_999, "máximo 999 999");

export const stockTrackingSchema = z.object({ track: z.boolean(), threshold: stockInt });
export const stockChangeSchema = z
  .object({ kind: z.enum(["entrada", "salida", "conteo"]), amount: stockInt, reason: z.string().trim().min(5, "el motivo exige al menos 5 caracteres").max(200, "máximo 200 caracteres") })
  .refine((value) => value.kind === "conteo" || value.amount > 0, { message: "la cantidad debe ser mayor que cero", path: ["amount"] });
export type StockChange = z.infer<typeof stockChangeSchema>;

/** Departamentos y regiones autónomas de Nicaragua: los mismos códigos de `sales.departments`. */
export const departments = [
  { code: "boaco", name: "Boaco" },
  { code: "carazo", name: "Carazo" },
  { code: "chinandega", name: "Chinandega" },
  { code: "chontales", name: "Chontales" },
  { code: "esteli", name: "Estelí" },
  { code: "granada", name: "Granada" },
  { code: "jinotega", name: "Jinotega" },
  { code: "leon", name: "León" },
  { code: "madriz", name: "Madriz" },
  { code: "managua", name: "Managua" },
  { code: "masaya", name: "Masaya" },
  { code: "matagalpa", name: "Matagalpa" },
  { code: "nueva_segovia", name: "Nueva Segovia" },
  { code: "rio_san_juan", name: "Río San Juan" },
  { code: "rivas", name: "Rivas" },
  { code: "raccn", name: "Costa Caribe Norte" },
  { code: "raccs", name: "Costa Caribe Sur" },
] as const;
export type DepartmentCode = (typeof departments)[number]["code"];
export const departmentCodes: readonly string[] = departments.map((d) => d.code);
export const departmentSchema = z.enum(departments.map((d) => d.code) as [DepartmentCode, ...DepartmentCode[]], { errorMap: () => ({ message: "elige el departamento de entrega" }) });
export const departmentName = (code: string | null | undefined): string => departments.find((d) => d.code === code)?.name ?? "";

/** Tienda pública (Fase 4): libreta de direcciones, carrito y checkout. Mismos límites que valida la base de datos. */
const optionalPhone = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .transform((value) => value ?? null)
  .refine((value) => value === null || /^[0-9+() -]{8,20}$/.test(value), "teléfono inválido");

/**
 * Dirección guardada. `latitude` y `longitude` están reservadas para el mapa (otra fase): hoy ningún formulario las llena,
 * pero el esquema y la base ya las aceptan, siempre juntas o ninguna.
 */
export const customerAddressSchema = z
  .object({
    label: z.string().trim().min(1, "escribe un nombre (por ejemplo, Casa)").max(40, "máximo 40 caracteres"),
    address: z.string().trim().min(5, "la dirección exige al menos 5 caracteres").max(240, "máximo 240 caracteres"),
    reference: optionalText(240),
    phone: optionalPhone,
    make_default: z.boolean().optional().default(false),
    latitude: z.number().min(-90).max(90).nullable().optional().transform((value) => value ?? null),
    longitude: z.number().min(-180).max(180).nullable().optional().transform((value) => value ?? null),
  })
  .refine((value) => (value.latitude === null) === (value.longitude === null), { message: "las coordenadas van completas o no van", path: ["latitude"] });
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;

export const paymentMethodSchema = z.enum(["efectivo", "tarjeta"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const cartLineSchema = z.object({
  variant_id: z.string().uuid(),
  quantity: z.number().int("usa un número entero").min(1, "mínimo 1").max(99, "máximo 99 por producto"),
});

/** Una tienda de la compra: sus productos y, si la hay, la cotización por ruta de su envío. */
const purchaseGroupSchema = z.object({
  store_id: z.string().uuid(),
  items: z.array(cartLineSchema).min(1, "el carrito está vacío").max(30, "máximo 30 productos distintos"),
  quote_id: z.string().uuid().nullable().optional().transform((value) => value ?? null),
});

/** Lo que el checkout único envía a `create_checkout`: hasta 4 tiendas, una dirección, un pin (el departamento sale del pin). */
export const purchaseSchema = z
  .object({
    groups: z.array(purchaseGroupSchema).min(1, "el carrito está vacío").max(4, "una compra admite hasta 4 tiendas"),
    payment_method: paymentMethodSchema,
    address: z.string().trim().min(5, "la dirección exige al menos 5 caracteres").max(240, "máximo 240 caracteres"),
    phone: phoneSchema,
    notes: optionalText(240),
    client_ref: z.string().uuid(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .superRefine((value, ctx) => {
    const stores = value.groups.map((group) => group.store_id);
    if (new Set(stores).size !== stores.length) ctx.addIssue({ code: "custom", path: ["groups"], message: "una tienda aparece dos veces en la compra" });
    if (value.groups.reduce((sum, group) => sum + group.items.length, 0) > 30) ctx.addIssue({ code: "custom", path: ["groups"], message: "máximo 30 productos distintos" });
  });
export type PurchaseInput = z.infer<typeof purchaseSchema>;

/** Cotización de la entrega de una tienda: clase (express o programado), costo y plazo de cada envío. */
export const deliveryGroupQuoteSchema = z.object({
  store_id: z.string().uuid(),
  items: z.array(cartLineSchema).min(1).max(30),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type DeliveryGroupQuoteInput = z.infer<typeof deliveryGroupQuoteSchema>;
