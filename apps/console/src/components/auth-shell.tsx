import { AuthLayout } from "@rapitrip/ui";
import type { ReactNode } from "react";

function siteHost() {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null;
  } catch {
    return null;
  }
}

/** Acceso de la consola: el diseño partido es común; aquí solo va el texto propio de la consola. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      subtitle="Consola de operación"
      headline="Una sola consola para operar Rapitrip"
      text="Director, encargado de ventas y comercios afiliados entran por la misma puerta. Cada rol ve solo lo que le corresponde."
      points={["Permisos por rol y por comercio, verificados en el servidor", "Acceso solo por invitación; nadie conoce tu contraseña", "Cada inicio de sesión queda registrado"]}
      footer={siteHost()}
    >
      {children}
    </AuthLayout>
  );
}
