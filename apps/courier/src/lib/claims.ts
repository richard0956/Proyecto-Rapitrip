import { appRoleSchema } from "@rapitrip/validation";

/** Cuenta con rol de repartidor activo (el claim lo pone la base de datos al emitir el token). */
export function claimsHaveCourierRole(claims: Record<string, unknown> | null | undefined): boolean {
  const raw = claims?.app_roles;
  if (!Array.isArray(raw)) return false;
  return raw.some((entry) => {
    const parsed = appRoleSchema.safeParse((entry as { role?: unknown } | null)?.role);
    return parsed.success && parsed.data === "repartidor";
  });
}
