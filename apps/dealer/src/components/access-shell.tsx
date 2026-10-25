import { Logo } from "@rapitrip/ui";
import type { ReactNode } from "react";

/** Marco de las pantallas de acceso: una sola columna, pensada para el teléfono. */
export function AccessShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col justify-center gap-6 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Logo tone="light" subtitle="Repartidores" priority className="[&_img]:h-11" />
      {children}
    </main>
  );
}
