"use client";

import { Alert, Button, Dialog } from "@rapitrip/ui";
import { useState, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  /** Devuelve el mensaje de error si la acción falló; nulo si salió bien (el diálogo se cierra). */
  onConfirm: (reason: string) => Promise<string | null>;
  /** Impide confirmar mientras falte algo (por ejemplo, la foto del intento). */
  blocked?: string | null;
  /** Contenido extra antes del motivo (por ejemplo, la foto del intento de entrega). */
  children?: ReactNode;
};

/** Pide una explicación de 5 a 200 caracteres antes de avisar a coordinación. */
export function ReasonDialog({ open, onClose, title, description, confirmLabel, danger, onConfirm, blocked, children }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = reason.trim();
  const valid = trimmed.length >= 5 && trimmed.length <= 200;

  async function submit() {
    setBusy(true);
    setError(null);
    const message = await onConfirm(trimmed);
    setBusy(false);
    if (message) return setError(message);
    setReason("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-tinta-suave">{description}</p>
        {children}
        <label className="flex flex-col gap-1.5 text-xs font-bold text-tinta-suave">
          Cuéntanos qué pasó
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={200} className="rounded-campo border border-borde-campo bg-white p-3 text-sm font-normal text-tinta" />
          <span className="font-normal">{trimmed.length}/200 · mínimo 5 caracteres</span>
        </label>
        {blocked ? <Alert tone="warning">{blocked}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="ghost" className="min-h-12" onClick={onClose} disabled={busy}>
            Volver
          </Button>
          <Button variant={danger ? "danger" : "primary"} className="min-h-12" onClick={submit} disabled={busy || !valid || Boolean(blocked)}>
            {busy ? "Enviando…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
