"use client";

import { Alert, Button, Dialog } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

type Props = {
  id: string;
  name: string;
  approve: (input: { id: string; convenio: boolean }) => Promise<ActionResult>;
  reject: (input: { id: string; reason: string }) => Promise<ActionResult>;
};

export function RequestActions({ id, name, approve, reject }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"aprobar" | "rechazar" | null>(null);
  const [convenio, setConvenio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = () => {
    setDialog(null);
    setConvenio(false);
    setError(null);
  };

  return (
    <div className="flex gap-1">
      <Button variant="ghost" className="min-h-9 px-3" aria-label={`Aprobar la solicitud de ${name}`} onClick={() => setDialog("aprobar")}>
        Aprobar
      </Button>
      <Button variant="ghost" className="min-h-9 px-3" aria-label={`Rechazar la solicitud de ${name}`} onClick={() => setDialog("rechazar")}>
        Rechazar
      </Button>

      <Dialog open={dialog === "aprobar"} onClose={close} title="Aprobar comercio">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            start(async () => {
              const result = await approve({ id, convenio });
              if (!result.ok) return setError(result.error);
              close();
              router.refresh();
            });
          }}
        >
          <p className="text-tinta-suave">Se creará el comercio «{name}» y se avisará a quien lo solicitó.</p>
          <label className="flex items-start gap-3 text-sm font-bold text-tinta">
            <input type="checkbox" checked={convenio} onChange={(e) => setConvenio(e.target.checked)} className="mt-0.5 size-5 accent-hoja" />
            Confirmo que el convenio con el comercio está firmado.
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="secondary" type="submit" disabled={pending || !convenio}>
              {pending ? "Aprobando…" : "Aprobar"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ReasonDialog
        open={dialog === "rechazar"}
        onClose={close}
        title="Rechazar solicitud"
        description={`El motivo se enviará a quien solicitó «${name}».`}
        confirmLabel="Rechazar"
        danger
        minLength={10}
        onConfirm={(reason) => reject({ id, reason })}
      />
    </div>
  );
}
