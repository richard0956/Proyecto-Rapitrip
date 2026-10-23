"use client";

import { Alert, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { Check, FileText, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

type Values = { full_name: string; phone: string; vehicle_type: string };

type Props = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: "activo" | "inactivo";
  update: (id: string, values: Values) => Promise<ActionResult>;
  setStatus: (input: { id: string; status: "activo" | "inactivo"; reason: string }) => Promise<ActionResult>;
  documentUrl: (input: { id: string }) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
};

/** Gestión del repartidor (solo administración): datos, activación y su documento. */
export function CourierEditCard({ id, name, phone, vehicle, status, update, setStatus, documentUrl }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ full_name: name, phone, vehicle_type: vehicle });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [statusDialog, setStatusDialog] = useState(false);
  const [pending, start] = useTransition();
  const next = status === "activo" ? "inactivo" : "activo";
  const set = (key: keyof Values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await update(id, values);
      setMessage(result.ok ? { ok: true, text: "Datos guardados." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  function openDocument() {
    setMessage(null);
    start(async () => {
      const result = await documentUrl({ id });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Gestionar repartidor" subtitle="Datos, activación y documento" />
      <form onSubmit={save} className="grid grid-cols-1 gap-3.5 md:grid-cols-3" noValidate>
        <Field label="Nombre completo" value={values.full_name} onChange={set("full_name")} required />
        <Field label="Teléfono" icon={<Smartphone className="size-4" />} type="tel" value={values.phone} onChange={set("phone")} required />
        <Field label="Vehículo" value={values.vehicle_type} onChange={set("vehicle_type")} placeholder="Moto, bicicleta, carro…" required />
        <div className="flex flex-wrap items-center gap-2.5 md:col-span-3">
          <Button variant="primary" type="submit" disabled={pending}>
            <Check className="size-4" aria-hidden="true" />
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          <Button variant={next === "inactivo" ? "danger" : "secondary"} onClick={() => setStatusDialog(true)} disabled={pending}>
            {next === "inactivo" ? "Desactivar" : "Activar"}
          </Button>
          <Button variant="ghost" onClick={openDocument} disabled={pending}>
            <FileText className="size-4" aria-hidden="true" />
            Ver documento
          </Button>
        </div>
      </form>
      {message ? <Alert tone={message.ok ? "info" : "error"} className="mt-3.5">{message.text}</Alert> : null}
      <Alert tone="warning" className="mt-3.5">
        Un repartidor desactivado no recibe asignaciones. El documento se abre con un enlace temporal y cada lectura queda auditada.
      </Alert>
      <ReasonDialog
        open={statusDialog}
        onClose={() => setStatusDialog(false)}
        title={next === "inactivo" ? "Desactivar repartidor" : "Activar repartidor"}
        description={`Se cambiará el estado de ${name} a «${next}».`}
        confirmLabel="Confirmar"
        danger={next === "inactivo"}
        onConfirm={(reason) => setStatus({ id, status: next, reason })}
      />
    </Card>
  );
}
