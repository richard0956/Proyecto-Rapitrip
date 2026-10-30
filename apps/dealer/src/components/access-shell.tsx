import { AuthLayout } from "@rapitrip/ui";
import type { ReactNode } from "react";

/** Acceso del repartidor: el diseño partido es común con la tienda y la consola; aquí va el texto propio del reparto. */
export function AccessShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      subtitle="Repartidores"
      headline="Tus propuestas y entregas, en el bolsillo"
      text="Recibe propuestas de coordinación, recoge en la tienda y entrega con código y foto. Todo desde el teléfono."
      points={["Acceso solo por invitación de coordinación", "Avisos de propuestas aunque la aplicación esté cerrada", "Cada recogida y entrega queda registrada con su evidencia"]}
    >
      {children}
    </AuthLayout>
  );
}
