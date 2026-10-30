"use client";

import { Alert, Button, TextareaField } from "@rapitrip/ui";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";

export type DeletionRequest = { id: string; full_name: string | null; email: string | null; reason: string | null; created_at: string };

/** Solicitudes de eliminación de cuenta de los clientes: aprobar anonimiza la cuenta; rechazar deja una nota que el cliente ve. */
export function DeletionRequests({ rows, resolve }: { rows: DeletionRequest[]; resolve: (input: unknown) => Promise<ActionResult> }) {
  if (rows.length === 0) return <p className="text-sm text-tinta-suave">No hay solicitudes pendientes.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <RequestItem key={row.id} row={row} resolve={resolve} />
      ))}
    </ul>
  );
}

function RequestItem({ row, resolve }: { row: DeletionRequest; resolve: (input: unknown) => Promise<ActionResult> }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (approve: boolean) =>
    start(async () => {
      setError(null);
      const result = await resolve({ id: row.id, approve, note });
      if (!result.ok) setError(result.error);
    });
  return (
    <li className="flex flex-col gap-2 rounded-panel border border-borde p-3">
      <p className="text-sm font-bold text-tinta">{row.full_name ?? "Sin nombre"} · <span className="font-normal">{row.email ?? "—"}</span></p>
      <p className="text-xs text-tinta-suave">Pedida el {new Date(row.created_at).toLocaleDateString("es")}{row.reason ? ` · Motivo: ${row.reason}` : ""}</p>
      <TextareaField label="Nota (queda en la auditoría; si rechazas, el cliente la ve)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button variant="danger" disabled={pending || note.trim().length < 5} onClick={() => run(true)}>Anonimizar cuenta</Button>
        <Button variant="secondary" disabled={pending || note.trim().length < 5} onClick={() => run(false)}>Rechazar</Button>
      </div>
    </li>
  );
}
