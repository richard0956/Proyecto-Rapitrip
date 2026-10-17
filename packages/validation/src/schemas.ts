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
  /** Fecha y hora local de Costa Rica (formato de `datetime-local`). */
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "fecha inválida"),
  reason: optionalText(200),
});
