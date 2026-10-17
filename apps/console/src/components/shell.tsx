import type { AppRole } from "@rapitrip/validation";
import { Button } from "@rapitrip/ui";
import type { ReactNode } from "react";
import { signOut } from "@/lib/actions";
import type { NavItem } from "@/lib/nav";
import { NavLinks } from "./nav-links";
import { SessionActivity } from "./session-activity";

const roleLabels: Record<AppRole, string> = {
  superadmin: "Director",
  admin: "Administrador",
  cajero: "Encargado de ventas (caja)",
  coordinador: "Encargado de ventas (coordinación)",
  comercio: "Comercio",
  cliente: "Cliente",
};

/** Barra lateral de 264 px en escritorio; por debajo de 1024 px la navegación pasa a un menú desplegable. */
export function Shell({ nav, email, role, children }: { nav: NavItem[]; email: string | null; role: AppRole | null; children: ReactNode }) {
  const items = nav.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <SessionActivity />
      <aside className="bg-selva p-4 text-papel lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <details className="group lg:[&>summary]:hidden" open>
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-titulo text-xl">
            Rapitrip · Consola
            <span className="text-sm font-bold lg:hidden">Menú</span>
          </summary>
          <p className="mb-6 hidden font-titulo text-xl lg:block">Rapitrip · Consola</p>
          <div className="mt-3 lg:mt-0">
            <NavLinks items={items} />
            <div className="mt-6 border-t border-menta-borde pt-4 text-sm">
              <p className="font-bold">{role ? roleLabels[role] : null}</p>
              <p className="break-all text-menta-borde">{email}</p>
              <form action={signOut} className="mt-3">
                <Button variant="ghost" type="submit" className="w-full bg-papel text-selva hover:bg-menta">
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </div>
        </details>
      </aside>
      <main className="mx-auto w-full max-w-[1176px] p-4 sm:p-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-titulo text-3xl text-selva">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-tinta-suave">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
