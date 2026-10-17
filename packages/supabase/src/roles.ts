import { appRoleSchema, consoleRoles, type AppRole } from "@rapitrip/validation";

export type ConsoleArea = "admin" | "operations" | "comercio";

const areaByRole: Record<AppRole, ConsoleArea | null> = {
  superadmin: "admin",
  admin: "admin",
  cajero: "operations",
  coordinador: "operations",
  comercio: "comercio",
  cliente: null,
};

/** Lee el rol del claim `app_role` que añade el hook `custom_access_token`. */
export function roleFromClaims(claims: Record<string, unknown> | null | undefined): AppRole | null {
  const parsed = appRoleSchema.safeParse(claims?.app_role);
  return parsed.success ? parsed.data : null;
}

export function isConsoleRole(role: AppRole | null): role is (typeof consoleRoles)[number] {
  return role !== null && (consoleRoles as readonly string[]).includes(role);
}

export function areaForRole(role: AppRole | null): ConsoleArea | null {
  return role ? areaByRole[role] : null;
}

export function homePathForRole(role: AppRole | null): string {
  const area = areaForRole(role);
  return area ? `/${area}` : "/sin-acceso";
}

export function canAccessArea(role: AppRole | null, area: ConsoleArea): boolean {
  return areaForRole(role) === area;
}

/** Los roles de consola exigen segundo factor. */
export function requiresMfa(role: AppRole | null): boolean {
  return isConsoleRole(role);
}

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: "/login" | "/mfa" | "/sin-acceso" };

export function decideConsoleAccess(input: {
  signedIn: boolean;
  role: AppRole | null;
  aal: "aal1" | "aal2" | null;
  area: ConsoleArea;
}): AccessDecision {
  if (!input.signedIn) return { kind: "redirect", to: "/login" };
  if (!isConsoleRole(input.role)) return { kind: "redirect", to: "/sin-acceso" };
  if (requiresMfa(input.role) && input.aal !== "aal2") return { kind: "redirect", to: "/mfa" };
  if (!canAccessArea(input.role, input.area)) return { kind: "redirect", to: "/sin-acceso" };
  return { kind: "allow" };
}
