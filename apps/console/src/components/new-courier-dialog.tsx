"use client";

import { Alert, Button, Dialog, Field } from "@rapitrip/ui";
import { Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

export type CourierValues = { full_name: string; phone: string; vehicle_type: string };

const empty: CourierValues = { full_name: "", phone: "", vehicle_type: "" };

export function NewCourierDialog({ open, onClose, create }: { open: boolean; onClose: () => void; create: (values: CourierValues) => Promise<ActionResult> }) {
  const router = useRouter();
  const [values, setValues] = useState<CourierValues>(empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof CourierValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function close() {
    setValues(empty);
    setError(null);
    onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await create(values);
      if (!result.ok) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onClose={close} title="Nuevo repartidor">
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <Field label="Nombre completo" value={values.full_name} onChange={set("full_name")} required />
        <Field label="Teléfono" icon={<Smartphone className="size-4" />} type="tel" value={values.phone} onChange={set("phone")} required />
        <Field label="Vehículo" value={values.vehicle_type} onChange={set("vehicle_type")} placeholder="Moto, bicicleta, carro…" required />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={pending || !values.full_name || !values.phone || !values.vehicle_type}>
            {pending ? "Guardando…" : "Crear repartidor"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
