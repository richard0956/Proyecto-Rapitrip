"use client";

import { Button } from "@rapitrip/ui";
import { useState, useTransition } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

type Props = {
  id: string;
  name: string;
  status: string;
  setStatus: (input: { id: string; status: "activo" | "inactivo"; reason: string }) => Promise<ActionResult>;
  documentUrl: (input: { id: string }) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
};

export function CourierActions({ id, name, status, setStatus, documentUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const next = status === "activo" ? "inactivo" : "activo";

  function openDocument() {
    setDocError(null);
    start(async () => {
      const result = await documentUrl({ id });
      if (!result.ok) return setDocError(result.error);
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button variant="ghost" className="min-h-9 px-3" onClick={openDocument} disabled={pending} aria-label={`Ver el documento de ${name}`}>
        Documento
      </Button>
      <Button variant="ghost" className="min-h-9 px-3" onClick={() => setOpen(true)} aria-label={`${next === "inactivo" ? "Desactivar" : "Activar"} a ${name}`}>
        {next === "inactivo" ? "Desactivar" : "Activar"}
      </Button>
      {docError ? (
        <span role="alert" className="text-sm font-bold">
          {docError}
        </span>
      ) : null}
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={next === "inactivo" ? "Desactivar repartidor" : "Activar repartidor"}
        description={`Se cambiará el estado de ${name} a «${next}».`}
        confirmLabel="Confirmar"
        danger={next === "inactivo"}
        onConfirm={(reason) => setStatus({ id, status: next, reason })}
      />
    </div>
  );
}
