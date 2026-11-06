import type { CSSProperties, ReactNode } from "react";

/**
 * Fila que se desliza sola, de derecha a izquierda y en bucle, sin JavaScript: son dos copias de la misma lista y el CSS
 * (`.auto-rail` en `globals.css`) corre cada una un ancho completo. Se detiene al pasar el cursor o al enfocar un enlace.
 *
 * Con «reducir movimiento» (preferencia del sistema o la de la tienda) no se anima: la copia desaparece y la fila vuelve a ser
 * una lista normal que se desliza con el dedo. La copia va oculta a los lectores de pantalla y sin foco (`inert`), así que
 * nadie recorre dos veces los mismos enlaces.
 *
 * `children` son los `<li>` de la lista; `count` fija la velocidad (más elementos, más tiempo por vuelta).
 */
export function AutoRail({ count, gap = "0.75rem", children }: { count: number; gap?: string; children: ReactNode }) {
  const style = { "--rail-gap": gap, "--rail-duration": `${Math.max(24, Math.round(count * 3.2))}s` } as CSSProperties;
  return (
    <div className="auto-rail" style={style}>
      <ul className="auto-rail-track">{children}</ul>
      <ul className="auto-rail-track auto-rail-copy" aria-hidden="true" inert>
        {children}
      </ul>
    </div>
  );
}
