import { AuthLayout } from "@rapitrip/ui";
import type { ReactNode } from "react";
import { AuthBackButton } from "./auth-back-button";

/** Acceso de la tienda: el diseño partido es común con la consola; aquí va el texto propio de la tienda. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      back={(tone) => <AuthBackButton tone={tone} />}
      headline="Compra en comercios afiliados y recibe en tu puerta"
      text="Con tu cuenta guardas tus datos y haces tus pedidos cuando el catálogo esté listo."
      points={["Ingresa con tu correo y tu contraseña", "Con la misma cuenta puedes pedir afiliar tu comercio", "Confirmamos tu correo para proteger tu cuenta"]}
    >
      {children}
    </AuthLayout>
  );
}
