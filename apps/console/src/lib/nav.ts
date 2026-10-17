import type { AppRole } from "@rapitrip/validation";

export type NavItem = { href: string; label: string; roles?: AppRole[] };

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/usuarios", label: "Usuarios y roles" },
  { href: "/admin/solicitudes", label: "Solicitudes de comercio" },
  { href: "/admin/repartidores", label: "Repartidores" },
  { href: "/admin/incidentes", label: "Incidentes de TI" },
  { href: "/admin/datos-personales", label: "Datos personales", roles: ["superadmin"] },
  { href: "/cuenta", label: "Mi cuenta" },
];

export const operationsNav: NavItem[] = [
  { href: "/operations", label: "Inicio" },
  { href: "/cuenta", label: "Mi cuenta" },
];

export const comercioNav: NavItem[] = [
  { href: "/comercio", label: "Inicio" },
  { href: "/cuenta", label: "Mi cuenta" },
];
