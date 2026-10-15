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