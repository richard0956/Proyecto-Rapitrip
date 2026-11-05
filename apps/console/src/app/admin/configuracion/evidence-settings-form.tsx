"use client";

import { Alert, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";
import type { EvidenceSettings } from "@/lib/evidence-settings";

type Props = { initial: EvidenceSettings; save: (input: EvidenceSettings) => Promise<ActionResult> };

/** Una exigencia de evidencia. `locked`: la exige el manual de políticas de TI y no se puede apagar. */
function Toggle({ label, hint, checked, onChange, locked }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void; locked?: string }) {
  return (
    <label className={`flex items-start gap-3 rounded-panel border border-borde p-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hoja ${locked ? "cursor-not-allowed bg-crema/60" : "cursor-pointer"}`}>
      <input type="checkbox" checked={locked ? true : checked} disabled={Boolean(locked)} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--hoja)]" />
      <span>
        <span className="block text-sm font-bold text-tinta">{label}</span>
        <span className="block text-xs text-tinta-suave">{hint}</span>
        {locked ? <span className="mt-1 block text-[11.5px] font-bold text-hoja">{locked}</span> : null}
      </span>
    </label>
  );
}

const requiredByPolicy = "Obligatorio: Norma 7.1 del manual de políticas de TI.";

/** Reglas de evidencia de las entregas. Cambiarlas aplica a los pedidos nuevos y a los que aún no pasaron por ese paso. */
export function EvidenceSettingsForm({ initial, save }: Props) {
  const [values, setValues] = useState(initial);
  const [distance, setDistance] = useState(String(initial.alertDistanceM));
  const [retention, setRetention] = useState(String(initial.retentionDays));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const distanceValue = Number(distance);
  const retentionValue = Number(retention);
  const distanceOk = Number.isInteger(distanceValue) && distanceValue >= 20 && distanceValue <= 2000;
  const retentionOk = Number.isInteger(retentionValue) && retentionValue >= 7 && retentionValue <= 365;

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await save({ ...values, deliveryPhoto: true, deliveryCode: true, alertDistanceM: distanceValue, retentionDays: retentionValue });
      setMessage(result.ok ? { ok: true, text: result.message ?? "Guardado." } : { ok: false, text: result.error });
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Evidencia de las entregas" subtitle="Qué debe registrar el repartidor desde su teléfono" />
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <fieldset className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <legend className="sr-only">Evidencia obligatoria</legend>
          <Toggle label="Foto al recoger" hint="El repartidor fotografía el paquete en la tienda antes de salir." checked={values.pickupPhoto} onChange={(pickupPhoto) => setValues((v) => ({ ...v, pickupPhoto }))} />
          <Toggle label="Código de recogida" hint="El comercio le muestra un código de 4 dígitos que él escribe." checked={values.pickupCode} onChange={(pickupCode) => setValues((v) => ({ ...v, pickupCode }))} />
          <Toggle label="Foto al entregar" hint="El repartidor fotografía el paquete en el lugar de entrega." checked={values.deliveryPhoto} onChange={(deliveryPhoto) => setValues((v) => ({ ...v, deliveryPhoto }))} locked={requiredByPolicy} />
          <Toggle label="Código de entrega" hint="El cliente le dicta un código de 4 dígitos que ve en su pedido." checked={values.deliveryCode} onChange={(deliveryCode) => setValues((v) => ({ ...v, deliveryCode }))} locked={requiredByPolicy} />
        </fieldset>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Distancia de alerta (metros)" inputMode="numeric" value={distance} onChange={(e) => setDistance(e.target.value.replace(/\D/g, ""))} hint="Si la foto se toma a más de esta distancia del punto, queda marcada para revisión. Entre 20 y 2000." error={distanceOk ? undefined : "Escribe un número entre 20 y 2000."} />
          <Field label="Conservar las fotos (días)" inputMode="numeric" value={retention} onChange={(e) => setRetention(e.target.value.replace(/\D/g, ""))} hint="Pasado este plazo se eliminan; quedan la huella y la hora. Entre 7 y 365." error={retentionOk ? undefined : "Escribe un número entre 7 y 365."} />
        </div>
        {!values.pickupPhoto || !values.pickupCode ? (
          <Alert tone="warning">Quitar una exigencia deja de proteger ese paso: el repartidor podrá avanzar el pedido sin esa evidencia.</Alert>
        ) : null}
        {message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}
        <div>
          <Button variant="primary" type="submit" disabled={pending || !distanceOk || !retentionOk}>
            {pending ? "Guardando…" : "Guardar reglas"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
