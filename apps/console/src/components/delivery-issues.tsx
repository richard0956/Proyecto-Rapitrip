"use client";

import { Badge, Button, Card, CardHeader } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { issueLabel } from "@/lib/order-trace";

export type IssueInfo = { id: string; kind: string; reason: string; createdAt: string };

const hints: Record<string, string> = {
  no_entregado: "El repartidor intentó entregar y no pudo. Decide si reintenta, lo devuelve a la tienda o se cancela.",
  no_cabe: "El pedido no cabe en su vehículo. Puedes reclasificarlo a programado para que lo lleve un vehículo más grande.",
  problema: "El repartidor te pide ayuda. Resuélvelo con él y deja constancia aquí.",
  devuelto: "El repartidor devolvió el pedido antes de recogerlo: quedó sin repartidor. Propónselo a otro.",
};

/** Avisos abiertos que el repartidor mandó desde su teléfono. Atenderlos deja constancia de qué se hizo. */
export function IssuesPanel({ issues, resolve, onReclassify }: { issues: IssueInfo[]; resolve: (issueId: string, note: string) => Promise<ActionResult>; onReclassify?: () => void }) {
  const router = useRouter();
  const [attending, setAttending] = useState<IssueInfo | null>(null);
  if (issues.length === 0) return null;
  return (
    <Card className="mb-3.5 border border-durazno p-4">
      <CardHeader title="Avisos del repartidor" subtitle="Esperan tu respuesta" actions={<Badge tone="warning">{issues.length}</Badge>} />
      <ul className="flex flex-col gap-3">
        {issues.map((issue) => (
          <li key={issue.id} className="rounded-panel bg-durazno/50 p-3 text-sm">
            <p className="font-bold text-tinta">{issueLabel[issue.kind] ?? "Aviso"}</p>
            <p className="text-tinta">«{issue.reason}»</p>
            <p className="mt-1 text-xs text-tinta-suave">{issue.createdAt}</p>
            <p className="mt-1 text-xs text-tinta-suave">{hints[issue.kind]}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {issue.kind === "no_cabe" && onReclassify ? (
                <Button variant="secondary" className="min-h-9 px-3" onClick={onReclassify}>
                  Reclasificar a programado
                </Button>
              ) : null}
              <Button variant="primary" className="min-h-9 px-3" onClick={() => setAttending(issue)}>
                Marcar como atendido
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {attending ? (
        <ReasonDialog
          open
          onClose={() => setAttending(null)}
          title="Atender el aviso"
          description="Escribe qué hiciste (por ejemplo «Se llamó al cliente y se reprograma para mañana»). Queda en el historial del pedido."
          confirmLabel="Marcar como atendido"
          minLength={3}
          onConfirm={async (note) => {
            const result = await resolve(attending.id, note);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
    </Card>
  );
}

/** Cinco intentos fallidos bloquean el código de recogida o de entrega; solo coordinación lo libera, con motivo. */
export function CodeResetPanel({ orderId, reset }: { orderId: string; reset: (orderId: string, kind: "recogida" | "entrega", reason: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [kind, setKind] = useState<"recogida" | "entrega" | null>(null);
  return (
    <div className="mb-3.5">
      <p className="mb-1.5 text-xs text-tinta-suave">Si el repartidor falló un código 5 veces, aquí lo desbloqueas. Antes, confirma con el comercio o el cliente que el repartidor está con ellos.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="min-h-9 px-3" onClick={() => setKind("recogida")}>
          Liberar código de recogida
        </Button>
        <Button variant="secondary" className="min-h-9 px-3" onClick={() => setKind("entrega")}>
          Liberar código de entrega
        </Button>
      </div>
      {kind ? (
        <ReasonDialog
          open
          onClose={() => setKind(null)}
          title={`Liberar el código de ${kind}`}
          description="Se reinician los intentos. Queda registrado quién lo liberó y por qué."
          confirmLabel="Liberar"
          onConfirm={async (reason) => {
            const result = await reset(orderId, kind, reason);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
    </div>
  );
}
