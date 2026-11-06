"use client";

import { Badge } from "@rapitrip/ui";
import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { dueState, slaRules, slaState, type SlaKind } from "@/lib/sla";

/**
 * Insignia del plazo que fija el manual de políticas de TI: «Vence en…» o «Vencido hace…», con el nombre del plazo al pasar el
 * cursor. La hora solo se lee en el navegador (en la primera pintura muestra el plazo, igual en servidor y cliente, y así no
 * rompe la hidratación) y se actualiza cada minuto.
 */
export function SlaBadge({ kind, from }: { kind: SlaKind; from: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
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

/** Igual que `SlaBadge`, pero con la fecha límite ya calculada (por ejemplo, la próxima liquidación según el convenio). */
export function DueBadge({ due, title }: { due: string; title: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  const state = now ? dueState(due, now) : null;
  return (
    <span title={title} className="inline-flex">
      <Badge tone={state?.tone ?? "neutral"}>
        <span className="inline-flex items-center gap-1">
          <Timer aria-hidden="true" className="size-3.5" />
          {state ? state.text : title}
        </span>
      </Badge>
    </span>
  );
}
