"use client";

import { Alert, Button, Dialog, Field, SelectField, TextareaField } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";

export function ReportIncident({ report }: { report: (input: { type: string; severity: string; description: string }) => Promise<ActionResult> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("interrupcion");
  const [severity, setSeverity] = useState("media");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setDescription("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await report({ type, severity, description });
      if (!result.ok) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Reportar incidente
      </Button>
      <Dialog open={open} onClose={close} title="Reportar incidente">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <SelectField label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="interrupcion">Interrupción</option>
            <option value="seguridad">Seguridad</option>
          </SelectField>
          <SelectField label="Gravedad" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </SelectField>
          <TextareaField label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} required />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={pending || description.trim().length < 5}>
              {pending ? "Enviando…" : "Reportar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

type Props = {
  id: string;
  status: "abierto" | "en_atencion" | "resuelto";
  setStatus: (input: { id: string; status: "en_atencion" | "resuelto"; resolution?: string }) => Promise<ActionResult>;
};

export function IncidentActions({ id, status, setStatus }: Props) {
  const router = useRouter();
  const [resolving, setResolving] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (status === "resuelto") return <span className="text-tinta-suave">—</span>;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {status === "abierto" ? (
        <Button
          variant="ghost"
          className="min-h-9 px-3"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await setStatus({ id, status: "en_atencion" });
              if (!result.ok) return setError(result.error);
              router.refresh();
            })
          }
        >
          Atender
        </Button>
      ) : null}
      <Button variant="ghost" className="min-h-9 px-3" onClick={() => setResolving(true)}>
        Resolver
      </Button>
      {error ? (
        <span role="alert" className="text-sm font-bold">
          {error}
        </span>
      ) : null}
      <ReasonDialog open={resolving} onClose={() => setResolving(false)} title="Resolver incidente" description="Describe cómo se resolvió. Queda en el historial del incidente." confirmLabel="Resolver" onConfirm={(resolution) => setStatus({ id, status: "resuelto", resolution })} />
    </div>
  );
}

/**
 * Norma 3.3.4 del manual de políticas de TI: cuando un incidente expone datos personales, se avisa a los afectados en 72 horas.
 * Aquí se deja constancia de ese aviso: por qué medio y qué se les informó.
 */
export function RecordNotice({ id, record }: { id: string; record: (input: { id: string; channel: string; note: string }) => Promise<ActionResult> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await record({ id, channel: channel.trim(), note: note.trim() });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" className="min-h-9 px-3" onClick={() => setOpen(true)}>
        Registrar aviso
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Aviso a los afectados">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-[13px] leading-snug text-tinta-suave">Deja constancia de que avisaste a las personas cuyos datos se expusieron, como pide la Norma 3.3.4 (72 horas).</p>
          <Field label="¿Por qué medio les avisaste?" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Correo a cada afectado, llamada…" required />
          <TextareaField label="¿Qué les informaste?" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qué datos se vieron afectados y qué pueden hacer" required />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={pending || channel.trim().length < 3 || note.trim().length < 10}>
              {pending ? "Guardando…" : "Registrar aviso"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
