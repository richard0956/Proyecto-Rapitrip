import type { ReactNode } from "react";

/** Una plantilla se vuelve a montar en cada navegación: eso dispara la animación de entrada de la página. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
