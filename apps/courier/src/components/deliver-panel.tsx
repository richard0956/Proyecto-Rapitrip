"use client";

import { Alert, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { Banknote } from "lucide-react";
import { useState } from "react";
import { formatMoney, parseMoney } from "@/lib/money";
import { actionMessage, checkCash } from "@/lib/results";
import { CodeField } from "./code-field";
import { PhotoCapture } from "./photo-capture";

type Props = {
  uploadedAt: string | null;
  pending: boolean;
  /** Total a cobrar si el pedido es en efectivo; nulo si ya está pagado. */
  cashTotal: number | null;
  onPhoto: (file: Blob) => Promise<void>;
  onConfirm: (input: { code: string; cash: number | null; receivedBy: string | null; note: string | null }) => Promise<{ result: string } | { error: string }>;
};

/** Entregar: foto en el lugar, código del cliente y, en efectivo, el monto cobrado. */
export function DeliverPanel({ uploadedAt, pending, cashTotal, onPhoto, onConfirm }: Props) {
  const [receivedBy, setReceivedBy] = useState("");
  const [cashText, setCashText] = useState(cashTotal !== null ? String(cashTotal) : "");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cash = cashTotal !== null ? checkCash(cashText, cashTotal, note, parseMoney) : null;
  const differs = cash?.differs === true;
  const ready = uploadedAt !== null && code.length === 4 && !busy && (cash === null || cash.ok);

  async function confirm() {
    if (cash && !cash.ok) return setMessage(cash.message);
    setBusy(true);
    setMessage(null);
    const outcome = await onConfirm({
      code,
      cash: cash?.ok ? cash.amount : null,
      receivedBy: receivedBy.trim() || null,
      note: note.trim() || null,
    });
    setBusy(false);
    if ("error" in outcome) return setMessage(outcome.error);
    const text = actionMessage(outcome.result);
    if (text) {
      setMessage(text);
      if (outcome.result === "incorrecto") setCode("");
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <CardHeader title="Entregar al cliente" subtitle="Foto, código y, si cobras, el monto" />
      <PhotoCapture
        label="1. Foto del paquete en el lugar de entrega"
        hint="Fotografía el paquete y la puerta o el número de casa. No fotografíes a las personas."
        uploadedAt={uploadedAt}
        pending={pending}
        onCapture={(file) => onPhoto(file)}
      />
      <Field label="¿Recibió otra persona? (opcional)" placeholder="Por ejemplo: Juan, vecino" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} maxLength={80} />
      {cashTotal !== null ? (
        <div className="flex flex-col gap-3 rounded-panel bg-durazno p-3">
          <p className="flex items-center gap-2 text-sm font-extrabold text-durazno-texto">
            <Banknote className="size-5" aria-hidden="true" /> Cobra {formatMoney(cashTotal)} en efectivo
          </p>
          <Field label="Monto que cobraste" inputMode="decimal" value={cashText} onChange={(e) => setCashText(e.target.value)} error={cash && !cash.ok && cashText !== "" ? "Escribe un monto válido, por ejemplo 350 o 350.50." : undefined} />
          {differs ? <Field label="Explica la diferencia" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} error={note.trim().length < 3 ? "Obligatorio si el monto no coincide." : undefined} /> : null}
        </div>
      ) : null}
      <CodeField label="2. Código de entrega (te lo da el cliente)" value={code} onChange={setCode} />
      {message ? <Alert tone="error">{message}</Alert> : null}
      <Button variant="primary" className="min-h-14 text-base" disabled={!ready} onClick={confirm}>
        {busy ? "Confirmando…" : "Confirmar entrega"}
      </Button>
      {uploadedAt === null ? <p className="text-center text-xs text-tinta-suave">Primero toma la foto; luego podrás confirmar.</p> : null}
    </Card>
  );
}
