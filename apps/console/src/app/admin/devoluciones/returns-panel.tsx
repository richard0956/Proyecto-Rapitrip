"use client";

import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field } from "@rapitrip/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { decideReturn } from "./actions";

export type ReturnRow = {
  id: string;
  orderNumber: number;
  store: string;
  total: number;
  method: "efectivo" | "tarjeta";
  status: "solicitada" | "aprobada" | "rechazada";
  reason: string;
  photos: { label: string; url: string | null }[];
  decisionNote: string | null;
  requestedAt: string;
  decidedAt: string | null;
};

const statusLabel: Record<ReturnRow["status"], string> = { solicitada: "Por decidir", aprobada: "Aprobada", rechazada: "Rechazada" };
const statusTone: Record<ReturnRow["status"], "warning" | "positive" | "danger"> = { solicitada: "warning", aprobada: "positive", rechazada: "danger" };

export function ReturnsPanel({ rows }: { rows: ReturnRow[] }) {
  return (
    <Card className="p-5">
      <CardHeader title="Solicitudes" subtitle="Revisa las fotos y decide. Aprobar con tarjeta envía el reembolso; en efectivo, la caja devuelve el dinero." />
      {rows.length === 0 ? (
        <EmptyState title="Sin devoluciones">Aquí aparecen las solicitudes de los últimos 3 días.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {rows.map((row) => (
            <ReturnItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReturnItem({ row }: { row: ReturnRow }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "aprobada" | "rechazada") {
    setBusy(true);
    setError(null);
    const result = await decideReturn({ id: row.id, decision, note });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block font-bold text-tinta">Pedido {row.orderNumber} · {formatMoney(row.total)} · {row.method === "tarjeta" ? "Tarjeta" : "Efectivo"}</span>
          <span className="block text-xs text-tinta-suave">{row.store} · solicitada {row.requestedAt}{row.decidedAt ? ` · decidida ${row.decidedAt}` : ""}</span>
          <Link href={`/admin/pedidos?pedido=${row.orderNumber}`} className="text-xs font-bold text-hoja underline-offset-2 hover:underline">
            Ver las evidencias de la entrega
          </Link>
        </span>
        <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
      </div>
      <p className="text-tinta"><span className="font-bold">Motivo:</span> {row.reason}</p>
      <div>
        <p className="mb-1 text-xs font-bold text-tinta-suave">Fotos ({row.photos.length})</p>
        <ul className="flex flex-col gap-0.5 text-xs text-tinta-suave">
          {row.photos.map((photo, index) => (
            <li key={photo.label + index} className="truncate">
              {photo.url ? <a href={photo.url} target="_blank" rel="noreferrer" className="font-bold text-hoja hover:underline">Ver foto {index + 1}</a> : `Foto ${index + 1} no disponible`}
            </li>
          ))}
        </ul>
      </div>
      {row.decisionNote ? <p className="text-xs text-tinta-suave"><span className="font-bold">Decisión:</span> {row.decisionNote}</p> : null}
      {row.status === "solicitada" ? (
        <div className="flex flex-col gap-3">
          <Field label="Nota de la decisión" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} hint="Obligatoria, mínimo 5 caracteres" />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => decide("aprobada")} disabled={busy || note.trim().length < 5}>
              Aprobar
            </Button>
            <Button variant="ghost" onClick={() => decide("rechazada")} disabled={busy || note.trim().length < 5}>
              Rechazar
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
