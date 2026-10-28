"use client";

import { cn } from "@rapitrip/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Carrusel horizontal de tarjetas: se desliza con el dedo o la rueda (con imán por tarjeta) y, en pantallas con cursor, con las
 * flechas de los lados, que se apagan al llegar a cada extremo. Las tarjetas llegan del servidor como hijos (`<li>`), así que
 * se ven igual que en las cuadrículas.
 */
export function ProductRail({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setEdges({ start: node.scrollLeft <= 4, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    update();
    node.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function move(direction: 1 | -1) {
    const node = ref.current;
    if (node) node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: "smooth" });
  }

  const arrow = "absolute top-[38%] z-20 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-superficie text-tinta shadow-flota ring-1 ring-selva/10 transition-[opacity,transform] duration-500 ease-fluido hover:scale-105 focus-visible:outline-2 focus-visible:outline-hoja disabled:pointer-events-none disabled:opacity-0 md:flex";

  return (
    <div className="relative mt-6">
      <button type="button" onClick={() => move(-1)} disabled={edges.start} aria-label={`Ver anteriores en ${label}`} className={cn(arrow, "-left-3 sm:-left-5")}>
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <ul
        ref={ref}
        aria-label={label}
        className="stagger -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 pb-3 pt-1 [scrollbar-width:none] sm:-mx-10 sm:gap-4 sm:px-10 [&::-webkit-scrollbar]:hidden [&>li]:w-[46%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-[31%] lg:[&>li]:w-[calc((100%-4rem)/5)]"
      >
        {children}
      </ul>
      <button type="button" onClick={() => move(1)} disabled={edges.end} aria-label={`Ver más en ${label}`} className={cn(arrow, "-right-3 sm:-right-5")}>
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
