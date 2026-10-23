"use client";

import { Alert, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { deliveryLimitsSchema, type ExpressLimits } from "@rapitrip/validation";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

/**
 * Límites de la entrega express: lo que cabe en una moto. Los comercios los ven al clasificar un producto y la base de datos
 * los aplica al crear el pedido. El tope de distancia (20 km) sale de las zonas de envío, no de aquí.
 */
export function DeliveryLimitsCard({ limits, save }: { limits: ExpressLimits; save: (input: unknown) => Promise<ActionResult> }) {
  const router = useRouter();
  const [values, setValues] = useState({ unit: String(limits.max_unit_kg), side: String(limits.max_side_cm), sum: String(limits.max_sum_cm), order: String(limits.max_order_kg) });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const input = { max_unit_kg: Number(values.unit), max_side_cm: Number(values.side), max_sum_cm: Number(values.sum), max_order_kg: Number(values.order) };
  const check = deliveryLimitsSchema.safeParse(input);

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await save(input);
      setMessage(result.ok ? { ok: true, text: "Límites guardados." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Límites de la entrega express" subtitle="Un producto solo puede ser express si cabe en una moto. Lo que supere estos límites se entrega como programado, con vehículo." />
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Peso por unidad (kg)" type="number" inputMode="decimal" min="0" step="0.01" value={values.unit} onChange={set("unit")} />
          <Field label="Lado más largo (cm)" type="number" inputMode="decimal" min="0" step="0.1" value={values.side} onChange={set("side")} />
          <Field label="Largo + ancho + alto (cm)" type="number" inputMode="decimal" min="0" step="0.1" value={values.sum} onChange={set("sum")} />
          <Field label="Peso por pedido express (kg)" type="number" inputMode="decimal" min="0" step="0.01" value={values.order} onChange={set("order")} />
        </div>
        {!check.success ? <Alert tone="warning">{check.error.issues[0]?.message}</Alert> : null}
        {message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}
        <Button variant="primary" type="submit" disabled={pending || !check.success} className="self-start">
          <Check className="size-4" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar límites"}
        </Button>
      </form>
    </Card>
  );
}
