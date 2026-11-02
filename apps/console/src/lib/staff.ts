/** Roles del equipo de Rapitrip (los demás son de comercios o del reparto). */
export const personalRoles = new Set(["superadmin", "admin", "cajero", "coordinador"]);

/** Alcance de un rol que no depende de un comercio. */
export const platformScope: Record<string, string> = { superadmin: "Plataforma", admin: "Plataforma", cajero: "Operaciones", coordinador: "Operaciones", repartidor: "Reparto" };

export const roleStatusTone = { activo: "positive", suspendido: "danger", revocado: "neutral" } as const;
export const roleStatusText = { activo: "Activo", suspendido: "Suspendido", revocado: "Revocado" } as const;
