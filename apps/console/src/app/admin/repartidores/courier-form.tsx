"use client";

import { Alert, Button, Dialog, Field } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

type Values = { full_name: string; phone: string; vehicle_type: string };

type Props = {
  triggerLabel: string;
  title: string;
  primary?: boolean;
  initial?: Values;
  ariaLabel?: string;
  submit: (values: Values) => Promise<ActionResult>;
};

export function CourierForm({ triggerLabel, title, primary, initial, ariaLabel, submit }: Props) {
  const router = useRouter();
  const empty: Values = { full_name: "", phone: "", vehicle_type: "" };
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(initial ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function close() {
    setOpen(false);
    setError(null);
    setValues(initial ?? empty);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await submit(values);
      if (!result.ok) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
    <>
      <Button variant={primary ? "primary" : "ghost"} className={primary ? undefined : "min-h-9 px-3"} aria-label={ariaLabel} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onClose={close} title={title}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Nombre completo" value={values.full_name} onChange={set("full_name")} required />
          <Field label="Teléfono" type="tel" value={values.phone} onChange={set("phone")} required />
          <Field label="Vehículo" value={values.vehicle_type} onChange={set("vehicle_type")} placeholder="Moto, bicicleta, carro…" required />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="secondary" type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
