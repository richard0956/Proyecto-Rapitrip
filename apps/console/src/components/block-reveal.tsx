"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Cuántos bloques como máximo se escalonan en una misma tanda: más allá, los demás entran juntos con el último retraso. */
const MAX_STEPS = 9;
/** Lo que espera la primera pantalla de la sesión a que suba la introducción (igual que `--intro-delay` en globals.css). */
const INTRO_MS = 1500;

/**
 * Ritmo de la entrada. El inicio de cada área (el panel) va más pausado: cada tarjeta aparece primero como esqueleto, con un
 * brillo que la recorre, y su contenido llega después; el resto de pantallas usa la misma idea, algo más ágil.
 * `step`: separación entre un bloque y el siguiente; `settle`: cuándo el bloque queda en reposo (tras sus gráficos y filas).
 * Los tiempos de cada fase están en `globals.css` (`[data-pace]`).
 */
const paces = {
  inicio: { step: 140, settle: 3000 },
  normal: { step: 90, settle: 2200 },
} as const;
export type RevealPace = keyof typeof paces;

/** El inicio de cada área: `/admin`, `/caja`, `/coordinacion`, `/comercio`. */
const homePaths = new Set(["/admin", "/caja", "/coordinacion", "/comercio"]);

export function paceFor(pathname: string | null): RevealPace {
  return pathname && homePaths.has(pathname) ? "inicio" : "normal";
}

/**
 * Los bloques de una pantalla: cada tarjeta (`data-block`, que pone `Card`) y cada pieza suelta que no contiene tarjetas
 * (encabezado, pestañas, avisos, filtros). Un contenedor con tarjetas dentro no es un bloque: se baja a sus hijos, así una
 * cuadrícula de tarjetas entra una por una. Los diálogos se saltan (aparecen solos al abrirse).
 */
export function collectBlocks(root: Element): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement) || child.tagName === "DIALOG" || child.tagName === "SCRIPT" || child.tagName === "TEMPLATE") continue;
    if (child.hasAttribute("data-block")) blocks.push(child);
    else if (child.querySelector("[data-block]")) blocks.push(...collectBlocks(child));
    else blocks.push(child);
  }
  return blocks;
}

/**
 * Entrada fluida de la consola, como la de la tienda: al abrir una pantalla, sus bloques suben, se enfocan y aparecen uno
 * tras otro (las tarjetas, primero como esqueleto y luego con su contenido); los que están más abajo lo hacen al llegar con el scroll. Lo que aparece después (una pestaña, un aviso, una
 * sección que se abre) entra igual. Con «Reducir animaciones» o con «reducir movimiento» del sistema, `globals.css` lo
 * muestra todo de una vez.
 *
 * Va en el `template.tsx` de cada área: la plantilla se vuelve a montar en cada navegación y eso reinicia la entrada.
 */
export function BlockReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pace = paceFor(usePathname());
  const paceRef = useRef(pace);
  paceRef.current = pace;

  // Antes del primer pintado: marca los bloques como pendientes para que no se vea ni un cuadro sin animar.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const seen = new WeakSet<HTMLElement>();
    let queue: HTMLElement[] = [];
    const timers: number[] = [];

    // Los que entran en la misma tanda se escalonan en el orden de la página.
    const flush = () => {
      const batch = queue.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      queue = [];
      const intro = document.documentElement.dataset.intro === "playing" ? INTRO_MS : 0;
      const { step, settle } = paces[paceRef.current];
      batch.forEach((block, index) => {
        const delay = Math.min(index, MAX_STEPS) * step;
        block.style.setProperty("--reveal-delay", `${delay}ms`);
        block.dataset.reveal = "visible";
        // Terminada la entrada (y el dibujo de sus gráficos), el bloque recupera sus propias transiciones, como el hover.
        timers.push(window.setTimeout(() => {
          block.dataset.reveal = "done";
          block.style.removeProperty("--reveal-delay");
        }, intro + delay + settle));
      });
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                observer?.unobserve(entry.target);
                queue.push(entry.target as HTMLElement);
              }
              // Las entradas de un mismo aviso llegan juntas: forman la tanda que se escalona.
              if (queue.length) flush();
            },
            { threshold: 0, rootMargin: "0px 0px -4% 0px" },
          );

    const track = () => {
      for (const block of collectBlocks(root)) {
        if (seen.has(block)) continue;
        seen.add(block);
        if (!observer) {
          block.dataset.reveal = "visible";
          continue;
        }
        block.dataset.reveal = "pending";
        observer.observe(block);
      }
    };

    track();
    root.dataset.ready = "";

    // Lo que React agrega después (pestañas, avisos, secciones que se abren) entra con la misma animación.
    // Se revisa en una microtarea: antes del siguiente pintado, para que lo nuevo no se vea ni un cuadro sin animar.
    let scheduled = false;
    const mutations = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        track();
      });
    });
    mutations.observe(root, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      mutations.disconnect();
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className="block-reveal" data-pace={pace}>
      {children}
    </div>
  );
}
