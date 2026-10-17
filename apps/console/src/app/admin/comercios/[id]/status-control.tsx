"use client";

import { Button } from "@rapitrip/ui";
import { useState } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

export function StatusControl({ id, name, suspended, setStatus }: { id: string; name: string; suspended: boolean; setStatus: (id: string, input: { status: "activo" | "suspendido"; reason: string }) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  const next = suspended ? "activo" : "suspendido";
  return (
    <>
      <Button variant={suspended ? "secondary" : "danger"} onClick={() => setOpen(true)}>
        {suspended ? "Reactivar comercio" : "Suspender comercio"}
      </Button>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        title={suspended ? "Reactivar comercio" : "Suspender comercio"}
        description={suspended ? `«${name}» recuperará el acceso y sus tiendas volverán a abrir según su horario.` : `«${name}» perderá el acceso y sus tiendas figurarán cerradas hasta que lo reactives.`}
        confirmLabel={suspended ? "Reactivar" : "Suspender"}
        danger={!suspended}
        onConfirm={(reason) => setStatus(id, { status: next, reason })}
      />
    </>
  );
}
