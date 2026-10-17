"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Aparece con un fundido pesado (sube, se enfoca) al entrar en pantalla. Usa IntersectionObserver, no eventos de scroll.
 * `index` escalona la entrada de varios elementos hermanos.
 */
export function Reveal({ index = 0, className, style, ...props }: HTMLAttributes<HTMLDivElement> & { index?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const show = () => node.setAttribute("data-visible", "true");
    if (typeof IntersectionObserver === "undefined") return show();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          show();
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={cn("reveal", className)} style={{ ...style, ["--i" as string]: index }} {...props} />;
}
