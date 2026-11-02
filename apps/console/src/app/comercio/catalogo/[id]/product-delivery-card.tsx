"use client";

import { expressLimitProblem, type ExpressLimits } from "@rapitrip/validation";
import { Alert, Badge, Button, Card, Field, cn } from "@rapitrip/ui";
import { Bike, Check, Ruler, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";
import { SectionHeader } from "./section-header";

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

  const options = [
    {
      value: "express" as const,
      icon: <Bike className="size-5" aria-hidden="true" />,
      title: "Express",
      tag: "En horas, en moto",
      text: `Productos pequeños y fáciles de llevar: hasta ${limits.max_unit_kg} kg y ${limits.max_side_cm} cm de lado (largo + ancho + alto hasta ${limits.max_sum_cm} cm). Un pedido express completo pesa hasta ${limits.max_order_kg} kg.`,
      disabled: product.categoryOnly,
    },
    {
      value: "programado" as const,
      icon: <Truck className="size-5" aria-hidden="true" />,
      title: "Programado",
      tag: "En días, con vehículo",
      text: "Productos grandes, pesados o que necesitan validación (televisores, sillones, bajo pedido). Lo lleva un repartidor con carro o camión. También lo es cualquier pedido a otro departamento o a más de 20 km.",
      disabled: false,
    },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <SectionHeader
        icon={<Truck className="size-[18px]" />}
        tone="lavanda"
        title="Tipo de entrega"
        subtitle="Define cómo viaja este producto: de esto depende qué repartidor lo lleva y en cuánto tiempo llega."
        actions={<Badge tone={effective === "express" ? "positive" : "neutral"}>Hoy: {effective === "express" ? "Express" : "Programado"}</Badge>}
      />

      {legacy ? <Alert tone="warning" className="mb-4">Este producto se entrega como express sin peso ni medidas registrados. Complétalos para confirmar que cabe en una moto.</Alert> : null}
      {product.categoryOnly ? <Alert className="mb-4">Su categoría solo se entrega de forma programada, así que no puede ser express.</Alert> : null}
      {!product.categoryOnly && product.expressEligible && !product.expressOk && !legacy ? (
        <Alert tone="warning" className="mb-4">Ya no cumple los límites vigentes de express, así que hoy se entrega como programado. Cambia las medidas o el tipo de entrega.</Alert>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <fieldset disabled={locked} className="flex flex-col gap-4">
          {/* Cada opción lleva su explicación: elegir y entender qué significa es un solo paso. */}
          <div role="radiogroup" aria-label="Tipo de entrega" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((option) => {
              const selected = kind === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-2 rounded-panel p-4 ring-1 transition-[box-shadow,background-color] duration-300",
                    selected ? "bg-menta/60 ring-2 ring-hoja" : "bg-papel ring-borde hover:ring-menta-borde",
                    option.disabled && "cursor-not-allowed opacity-55",
                  )}
                >
                  <input type="radio" name="tipo-entrega" value={option.value} checked={selected} disabled={option.disabled} onChange={() => setKind(option.value)} className="peer sr-only" />
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-xl", selected ? "bg-hoja text-sobre-acento" : "bg-crema text-tinta-suave")}>
                        {option.icon}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-tinta">{option.title}</span>
                        <span className="block text-[11.5px] font-semibold text-tinta-suave">{option.tag}</span>
                      </span>
                    </span>
                    <span aria-hidden="true" className={cn("flex size-5 items-center justify-center rounded-full ring-2", selected ? "bg-hoja ring-hoja" : "ring-borde-campo")}>
                      {selected ? <Check className="size-3 text-sobre-acento" strokeWidth={3} /> : null}
                    </span>
                  </span>
                  <span className="text-[12.5px] leading-snug text-tinta-suave">{option.text}</span>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-panel peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hoja" />
                </label>
              );
            })}
          </div>

          <div className="rounded-panel bg-crema/70 p-4 ring-1 ring-borde">
            <p className="mb-3 flex items-center gap-2 text-[12.5px] font-bold text-tinta">
              <Ruler className="size-4 text-tinta-suave" aria-hidden="true" />
              Peso y medidas
              {kind === "programado" ? <span className="rounded-full bg-papel px-2 py-0.5 text-[10.5px] font-bold text-tinta-suave ring-1 ring-borde">Opcional</span> : null}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Peso (kg)" type="number" inputMode="decimal" min="0" step="0.01" value={values.weight} onChange={set("weight")} />
              <Field label="Largo (cm)" type="number" inputMode="decimal" min="0" step="0.1" value={values.length} onChange={set("length")} />
              <Field label="Ancho (cm)" type="number" inputMode="decimal" min="0" step="0.1" value={values.width} onChange={set("width")} />
              <Field label="Alto (cm)" type="number" inputMode="decimal" min="0" step="0.1" value={values.height} onChange={set("height")} />
            </div>
          </div>
          {kind === "programado" ? (
            <Field label="Días de validación (opcional)" type="number" inputMode="numeric" min="0" max="60" step="1" value={values.days} onChange={set("days")} hint="Días extra que necesitas antes de entregarlo: armado, importación, confirmar con el proveedor." />
          ) : null}
        </fieldset>
        {problem ? <Alert tone="warning">{problem}</Alert> : null}
        <div className="flex flex-col gap-3 border-t border-borde pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">{message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}</div>
          <Button variant="primary" type="submit" disabled={pending || locked || problem !== null} className="shrink-0 self-end sm:self-auto">
            <Check className="size-4" aria-hidden="true" />
            {pending ? "Guardando…" : "Guardar tipo de entrega"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
