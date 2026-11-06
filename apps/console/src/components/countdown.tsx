"use client";

import { Badge } from "@rapitrip/ui";
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

/** Minutos y segundos que quedan. La hora solo se lee en el navegador para no romper la hidratación. */
export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // La primera lectura va en un temporizador (no directo en el efecto) y luego cada segundo.
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  if (now === null) return <Badge tone="neutral">Por confirmar</Badge>;
  const left = Math.max(0, new Date(until).getTime() - now);
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return (
    <Badge tone={left === 0 ? "danger" : left < 5 * 60_000 ? "warning" : "positive"}>
      <span className="inline-flex items-center gap-1 tabular-nums">
        <Timer aria-hidden="true" className="size-3.5" />
        {left === 0 ? "Venció" : `Quedan ${minutes}:${String(seconds).padStart(2, "0")}`}
      </span>
    </Badge>
  );
}
