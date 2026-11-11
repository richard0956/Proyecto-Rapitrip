"use client";

import { scrollBehavior } from "@rapitrip/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Carrusel manual de categorías, centrado cuando cabe y con espacio para los bordes y el foco. */
export function AutoRail({ count, gap = "0.75rem", children }: { count: number; gap?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [edges, setEdges] = useState({ start: true, end: true });
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
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    if (node.firstElementChild) observer?.observe(node.firstElementChild);
    return () => {
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [count, update]);

  function move(direction: -1 | 1) {
    const node = ref.current;
    if (node) node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: scrollBehavior() });
  }

  const arrow = "flex size-11 items-center justify-center rounded-full bg-superficie text-tinta ring-1 ring-selva/20 transition-opacity hover:bg-menta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:cursor-default disabled:opacity-30";
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 sm:gap-3" style={{ "--rail-gap": gap } as CSSProperties}>
      <button type="button" aria-label="Ver categorías anteriores" aria-controls={id} disabled={edges.start} onClick={() => move(-1)} className={arrow}>
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <div ref={ref} id={id} className="auto-rail">
        <ul className="auto-rail-track">{children}</ul>
      </div>
      <button type="button" aria-label="Ver más categorías" aria-controls={id} disabled={edges.end} onClick={() => move(1)} className={arrow}>
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
