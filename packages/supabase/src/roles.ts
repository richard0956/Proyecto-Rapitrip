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

/** Prioridad cuando una cuenta tiene varios roles activos. */
const rolePriority: AppRole[] = ["superadmin", "admin", "coordinador", "cajero", "comercio", "cliente"];

/** Lee los roles del claim `app_roles` que añade el hook `custom_access_token` y devuelve el de mayor prioridad. */
export function roleFromClaims(claims: Record<string, unknown> | null | undefined): AppRole | null {
  const raw = claims?.app_roles;
  if (!Array.isArray(raw)) return null;
  const found = new Set<AppRole>();
  for (const entry of raw) {
    const parsed = appRoleSchema.safeParse((entry as { role?: unknown } | null)?.role);
    if (parsed.success) found.add(parsed.data);
  }
  return rolePriority.find((role) => found.has(role)) ?? null;
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

const managedBy: Partial<Record<AppRole, readonly AppRole[]>> = {
  superadmin: ["admin", "cajero", "coordinador", "comercio", "cliente"],
  admin: ["cajero", "coordinador", "comercio", "cliente"],
};

/** Espejo de `private.role_management`. Solo decide qué botones mostrar: la base de datos vuelve a comprobarlo. */
export function canManageRole(manager: AppRole | null, target: AppRole | null): boolean {
  return Boolean(manager && target && managedBy[manager]?.includes(target));
}

/** Roles que `manager` puede asignar por invitación (el backend solo invita admin, cajero y coordinador). */
export function invitableRoles(manager: AppRole | null): AppRole[] {
  return (["admin", "cajero", "coordinador"] as const).filter((role) => canManageRole(manager, role));
}
