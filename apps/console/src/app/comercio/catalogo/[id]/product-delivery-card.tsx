"use client";

import { expressLimitProblem, type ExpressLimits } from "@rapitrip/validation";
import { Alert, Badge, Button, Card, CardHeader, Field, SelectField } from "@rapitrip/ui";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

export type DeliveryProduct = {
  id: string;
  expressEligible: boolean;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  validationDays: number | null;
  /** Lo que la base de datos concluye hoy: elegible, dentro de los límites vigentes y fuera de categorías «solo programado». */
  expressOk: boolean;
  /** La categoría guardada del producto es «solo programado». */
  categoryOnly: boolean;
};

const text = (value: number | null) => (value === null ? "" : String(value));
const toNumber = (value: string) => (value.trim() === "" ? null : Number(value));

/**
 * Tipo de entrega del producto. Express: pequeño, en horas, en moto. Programado: grande o con validación, en días, con vehículo.
 * La clase final del pedido también depende del destino (otro departamento o más de 20 km es siempre programado).
 */
export function ProductDeliveryCard({ product, limits, locked, save }: { product: DeliveryProduct; limits: ExpressLimits; locked: boolean; save: (id: string, input: unknown) => Promise<ActionResult> }) {
  const router = useRouter();
  const [kind, setKind] = useState<"express" | "programado">(product.expressEligible && !product.categoryOnly ? "express" : "programado");
  const [values, setValues] = useState({ weight: text(product.weightKg), length: text(product.lengthCm), width: text(product.widthCm), height: text(product.heightCm), days: text(product.validationDays) });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const measures = { weight_kg: toNumber(values.weight), length_cm: toNumber(values.length), width_cm: toNumber(values.width), height_cm: toNumber(values.height) };
  const problem = kind === "express" ? expressLimitProblem(measures, limits) : null;
  const legacy = product.expressEligible && !product.categoryOnly && product.weightKg === null;
  const effective = product.expressOk ? "express" : "programado";

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await save(product.id, { express_eligible: kind === "express", ...measures, validation_days: toNumber(values.days) });
      setMessage(result.ok ? { ok: true, text: "Tipo de entrega guardado." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Tipo de entrega"
        subtitle="Define cómo viaja este producto. Elige bien: de esto depende qué repartidor lo lleva y en cuánto tiempo llega."
        actions={<Badge tone={effective === "express" ? "positive" : "neutral"}>{effective === "express" ? "Express" : "Programado"}</Badge>}
      />
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-panel bg-calido/50 p-4 text-[13px] text-tinta sm:grid-cols-2">
        <div>
          <p className="font-bold">Express · en horas, en moto</p>
          <p className="text-tinta-suave">
            Productos pequeños y fáciles de llevar: hasta {limits.max_unit_kg} kg y {limits.max_side_cm} cm de lado (largo + ancho + alto hasta {limits.max_sum_cm} cm). Un pedido express completo pesa hasta {limits.max_order_kg} kg.
          </p>
        </div>
        <div>
          <p className="font-bold">Programado · en días, con vehículo</p>
          <p className="text-tinta-suave">Productos grandes, pesados o que necesitan validación (televisores, sillones, bajo pedido). Lo lleva un repartidor con carro o camión. También lo es cualquier pedido a otro departamento o a más de 20 km.</p>
        </div>
      </div>

      {legacy ? <Alert tone="warning" className="mb-4">Este producto se entrega como express sin peso ni medidas registrados. Complétalos para confirmar que cabe en una moto.</Alert> : null}
      {product.categoryOnly ? <Alert className="mb-4">Su categoría solo se entrega de forma programada, así que no puede ser express.</Alert> : null}
      {!product.categoryOnly && product.expressEligible && !product.expressOk && !legacy ? (
        <Alert tone="warning" className="mb-4">Ya no cumple los límites vigentes de express, así que hoy se entrega como programado. Cambia las medidas o el tipo de entrega.</Alert>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <fieldset disabled={locked} className="flex flex-col gap-3.5">
          <SelectField label="Tipo de entrega" value={kind} onChange={(e) => setKind(e.target.value === "express" ? "express" : "programado")}>
            <option value="express" disabled={product.categoryOnly}>Express (moto, en horas)</option>
            <option value="programado">Programado (vehículo, en días)</option>
          </SelectField>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Peso (kg)" type="number" inputMode="decimal" min="0" step="0.01" value={values.weight} onChange={set("weight")} />
            <Field label="Largo (cm)" type="number" inputMode="decimal" min="0" step="0.1" value={values.length} onChange={set("length")} />
            <Field label="Ancho (cm)" type="number" inputMode="decimal" min="0" step="0.1" value={values.width} onChange={set("width")} />
            <Field label="Alto (cm)" type="number" inputMode="decimal" min="0" step="0.1" value={values.height} onChange={set("height")} />
          </div>
          {kind === "programado" ? (
            <Field label="Días de validación (opcional)" type="number" inputMode="numeric" min="0" max="60" step="1" value={values.days} onChange={set("days")} hint="Días extra que necesitas antes de entregarlo: armado, importación, confirmar con el proveedor." />
          ) : null}
        </fieldset>
        {problem ? <Alert tone="warning">{problem}</Alert> : null}
        {message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}
        <Button variant="primary" type="submit" disabled={pending || locked || problem !== null} className="self-start">
          <Check className="size-4" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar tipo de entrega"}
        </Button>
      </form>
    </Card>
  );
}
