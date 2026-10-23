import { Card, CardHeader } from "@rapitrip/ui";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import type { OrderEvidence } from "@/lib/types";

const labels: Record<string, string> = {
  recogida: "Foto de recogida",
  entrega: "Foto de entrega",
  fallida: "Intento de entrega",
  devolucion_tienda: "Devolución a la tienda",
};
const time = new Intl.DateTimeFormat("es-NI", { hour: "2-digit", minute: "2-digit", timeZone: "America/Managua" });

/** Lo que ya quedó registrado de este pedido, y lo que espera señal para subirse. */
export function EvidenceList({ evidence, pendingKinds }: { evidence: OrderEvidence[]; pendingKinds: string[] }) {
  if (evidence.length === 0 && pendingKinds.length === 0) return null;
  return (
    <Card className="p-4">
      <CardHeader title="Evidencias" subtitle="Quedan guardadas con la hora" />
      <ul className="flex flex-col gap-2 text-[13.5px]">
        {evidence.map((item) => (
          <li key={item.evidence_id} className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-hoja" aria-hidden="true" />
            <span>
              {labels[item.kind] ?? item.kind} · {time.format(new Date(item.taken_at))}
              {item.flag_reason === "sin_ubicacion" ? <span className="block text-xs text-tinta-suave">Sin ubicación: activa el GPS la próxima vez.</span> : null}
              {item.flag_reason === "lejos_del_punto" ? (
                <span className="flex items-center gap-1 text-xs text-durazno-texto">
                  <TriangleAlert className="size-3" aria-hidden="true" /> Tomada lejos del punto marcado
                </span>
              ) : null}
            </span>
          </li>
        ))}
        {pendingKinds.map((kind, index) => (
          <li key={`${kind}-${index}`} className="flex items-center gap-2 text-durazno-texto">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            {labels[kind] ?? kind} · esperando señal
          </li>
        ))}
      </ul>
    </Card>
  );
}
