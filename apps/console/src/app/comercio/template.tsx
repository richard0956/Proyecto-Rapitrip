import type { ReactNode } from "react";
import { BlockReveal } from "@/components/block-reveal";

/** Una plantilla se vuelve a montar en cada navegación: eso reinicia la entrada escalonada de los bloques de la pantalla. */
export default function Template({ children }: { children: ReactNode }) {
  return <BlockReveal>{children}</BlockReveal>;
}
