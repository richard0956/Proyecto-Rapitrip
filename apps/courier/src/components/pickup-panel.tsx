"use client";

import { Alert, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { useState } from "react";
import { actionMessage } from "@/lib/results";
import { CodeField } from "./code-field";
import { PhotoCapture } from "./photo-capture";

type Props = {
  uploadedAt: string | null;
  pending: boolean;
  onPhoto: (file: File, units: number | null) => Promise<void>;
  /** Llama a `courier_pick_up`; devuelve el texto del resultado o un mensaje de error. */
  onConfirm: (code: string) => Promise<{ result: string } | { error: string }>;
};

/** Recoger en la tienda: foto del paquete, cuántos bultos y el código que muestra el comercio. */
export function PickupPanel({ uploadedAt, pending, onPhoto, onConfirm }: Props) {
  const [units, setUnits] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bultos = units.trim() === "" ? null : Number(units);
  const bultosValid = bultos === null || (Number.isInteger(bultos) && bultos >= 1 && bultos <= 99);
  const ready = uploadedAt !== null && code.length === 4 && !busy;

  async function confirm() {
    setBusy(true);
    setMessage(null);
    const outcome = await onConfirm(code);
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
      <CardHeader title="Recoger en la tienda" subtitle="Foto del paquete y código del comercio" />
      <Field
        label="Bultos (opcional)"
        inputMode="numeric"
        value={units}
        onChange={(e) => setUnits(e.target.value.replace(/\D/g, "").slice(0, 2))}
        error={bultosValid ? undefined : "Entre 1 y 99."}
        hint="Cuenta los paquetes que recibes."
      />
      <PhotoCapture
        label="1. Foto del paquete con el número de pedido visible"
        hint="Pide al comercio que ponga el número del pedido junto al paquete."
        uploadedAt={uploadedAt}
        pending={pending}
        onCapture={(file) => onPhoto(file, bultosValid ? bultos : null)}
      />
      <CodeField label="2. Código de recogida (te lo muestra el comercio)" value={code} onChange={setCode} />
      {message ? <Alert tone="error">{message}</Alert> : null}
      <Button variant="primary" className="min-h-14 text-base" disabled={!ready} onClick={confirm}>
        {busy ? "Confirmando…" : "Confirmar recogida"}
      </Button>
      {uploadedAt === null ? <p className="text-center text-xs text-tinta-suave">Primero toma la foto; luego podrás confirmar.</p> : null}
    </Card>
  );
}
