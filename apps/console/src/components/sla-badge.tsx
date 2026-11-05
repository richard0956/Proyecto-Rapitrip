"use client";

import { Badge } from "@rapitrip/ui";
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { slaRules, slaState, type SlaKind } from "@/lib/sla";

/**
 * Insignia del plazo que fija el manual de políticas de TI: «Vence en…» o «Vencido hace…», con el nombre del plazo al pasar el
 * cursor. La hora solo se lee en el navegador (en la primera pintura muestra el plazo, igual en servidor y cliente, y así no
 * rompe la hidratación) y se actualiza cada minuto.
 */
export function SlaBadge({ kind, from }: { kind: SlaKind; from: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const rule = slaRules[kind];
  const state = now ? slaState(kind, from, now) : null;
  return (
    <span title={`Plazo: ${rule.label} (${rule.norm} del manual de políticas de TI)`} className="inline-flex">
      <Badge tone={state?.tone ?? "neutral"}>
        <span className="inline-flex items-center gap-1">
          <Timer aria-hidden="true" className="size-3.5" />
          {state ? state.text : `Plazo: ${rule.label}`}
        </span>
      </Badge>
    </span>
  );
}
