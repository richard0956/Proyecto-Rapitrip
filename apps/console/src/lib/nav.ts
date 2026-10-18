import type { AppRole } from "@rapitrip/validation";

export type NavIcon =
  | "home" | "users" | "file" | "store" | "layers" | "truck" | "settings" | "orders" | "activity" | "alert" | "cash" | "receipt" | "clock" | "shield" | "lock" | "user";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Rutas adicionales que también marcan este ítem como activo. */
  also?: string[];
  roles?: AppRole[];
  /** Pantallas de fases posteriores: se muestran, pero todavía no llevan a ninguna parte. */
  soon?: boolean;
};

export type NavSection = { label?: string; items: NavItem[] };

export const adminNav: NavSection[] = [
  { label: "Resumen", items: [{ href: "/admin", label: "Inicio", icon: "home" }] },
  {
    label: "Administración",
    items: [
      { href: "/admin/usuarios", label: "Usuarios y roles", icon: "users" },
      { href: "/admin/solicitudes", label: "Solicitudes de comercio", icon: "file" },
      { href: "/admin/comercios", label: "Comercios y tiendas", icon: "store" },
      { href: "/admin/catalogo", label: "Catálogo maestro", icon: "layers" },
      { href: "/admin/repartidores", label: "Repartidores", icon: "truck" },
      { href: "/admin/configuracion", label: "Configuración", icon: "settings", soon: true },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: "orders" },
      { href: "/admin/tablero", label: "Tablero en vivo", icon: "activity", soon: true },
      { href: "/admin/excepciones", label: "Excepciones", icon: "alert" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/admin/caja", label: "Caja y venta", icon: "cash" },
      { href: "/admin/liquidaciones", label: "Liquidaciones", icon: "receipt", soon: true },
    ],
  },
  {
    label: "Control",
    items: [
      { href: "/admin/auditoria", label: "Auditoría y accesos", icon: "clock", also: ["/admin/accesos"] },
      { href: "/admin/incidentes", label: "Incidentes de TI", icon: "shield" },
      { href: "/admin/datos-personales", label: "Datos personales", icon: "lock", roles: ["superadmin"] },
    ],
  },
];

export const cajaNav: NavSection[] = [{ items: [{ href: "/caja", label: "Caja y venta", icon: "cash" }] }];
export const coordinacionNav: NavSection[] = [{ items: [{ href: "/coordinacion", label: "Pedidos", icon: "orders" }] }];
export const comercioNav: NavSection[] = [
  {
    items: [
      { href: "/comercio", label: "Inicio", icon: "home" },
      { href: "/comercio/pedidos", label: "Pedidos", icon: "receipt" },
      { href: "/comercio/tiendas", label: "Mis tiendas", icon: "store" },
      { href: "/comercio/catalogo", label: "Catálogo", icon: "layers"},
      { href: "/comercio/inventario", label: "Inventario", icon: "orders" },
    ],
  },
];

/** Los enlaces de cuenta van al pie de la barra, separados del resto. */
export const accountItem: NavItem = { href: "/cuenta", label: "Mi cuenta", icon: "user" };
