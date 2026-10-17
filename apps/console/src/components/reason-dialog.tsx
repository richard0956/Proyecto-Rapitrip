"use client";

import { Alert, Button, Dialog, TextareaField } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";

export type ReasonDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  minLength?: number;
  onConfirm: (reason: string) => Promise<ActionResult>;
};

/** Confirmación con motivo obligatorio: la longitud mínima coincide con la que exige la función de base de datos. */
export function ReasonDialog({ open, onClose, title, description, confirmLabel, danger, minLength = 5, onConfirm }: ReasonDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setReason("");
    setError(null);
    onClose();
  }

  function submit() {
    setError(null);
    start(async () => {
      const result = await onConfirm(reason.trim());
      if (!result.ok) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onClose={close} title={title}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        {description ? <p className="text-tinta-suave">{description}</p> : null}
        <TextareaField label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Mínimo ${minLength} caracteres`} required />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "secondary"} type="submit" disabled={pending || reason.trim().length < minLength}>
            {pending ? "Guardando…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
