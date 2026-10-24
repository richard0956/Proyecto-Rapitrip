import { Badge } from "@rapitrip/ui";
import { statusLabel } from "@/lib/order-steps";

const tone = { confirmado: "neutral", preparando: "warning", listo: "positive", en_camino: "positive", entregado: "neutral" } as const;

export function StatusBadge({ status }: { status: string | null }) {
  return <Badge tone={tone[status as keyof typeof tone] ?? "neutral"}>{statusLabel[status ?? ""] ?? status ?? "—"}</Badge>;
}

export function ClassBadge({ value }: { value: string | null }) {
  if (!value) return null;
  return <Badge tone={value === "express" ? "positive" : "warning"}>{value === "express" ? "Express" : "Programado"}</Badge>;
}
