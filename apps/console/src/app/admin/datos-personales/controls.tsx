"use client";

import { Alert, Button, Dialog, Field, SelectField, TextareaField } from "@rapitrip/ui";
import { useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import type { ClientDetail, ExportResult } from "./actions";

type CandidateProps = {
  userId: string;
  detail: (input: { userId: string }) => Promise<{ ok: true; detail: ClientDetail } | { ok: false; error: string }>;
  anonymize: (input: { userId: string; reason: string }) => Promise<ActionResult>;
};

export function CandidateActions({ userId, detail, anonymize }: CandidateProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [data, setData] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openDetail() {
    setError(null);
    setData(null);
    setShowDetail(true);
    start(async () => {
      const result = await detail({ userId });
      if (result.ok) setData(result.detail);
      else setError(result.error);
    });
  }

  return (
    <div className="flex gap-1">
      <Button variant="ghost" className="min-h-9 px-3" onClick={openDetail}>
        Ver detalle
      </Button>
      <Button variant="ghost" className="min-h-9 px-3" onClick={() => setAnonymizing(true)}>
        Anonimizar
      </Button>
      <Dialog open={showDetail} onClose={() => setShowDetail(false)} title="Detalle de la cuenta">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-tinta-suave">Esta lectura queda registrada en la auditoría.</p>
          {pending ? <p>Cargando…</p> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          {data ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="font-bold">Nombre</dt>
              <dd>{data.full_name ?? "—"}</dd>
              <dt className="font-bold">Correo</dt>
              <dd className="break-all">{data.email ?? "—"}</dd>
              <dt className="font-bold">Teléfono</dt>
              <dd>{data.phone ?? "—"}</dd>
              <dt className="font-bold">Estado</dt>
              <dd>{data.status}</dd>
            </dl>
          ) : null}
          <Button variant="primary" onClick={() => setShowDetail(false)}>
            Cerrar
          </Button>
        </div>
      </Dialog>
      <ReasonDialog open={anonymizing} onClose={() => setAnonymizing(false)} title="Anonimizar cuenta" description="Se borrarán de forma definitiva los datos personales de esta cuenta. No se puede deshacer." confirmLabel="Anonimizar" danger onConfirm={(reason) => anonymize({ userId, reason })} />
    </div>
  );
}

export function ExportForm({ request }: { request: (input: { dataset: string; reason: string; from?: string; to?: string; recipient: string; channel: string; identityVerified: boolean }) => Promise<ExportResult> }) {
  const [dataset, setDataset] = useState("accounts");
  const [reason, setReason] = useState("");
  // Control 1.1.1 del manual de políticas de TI: para quién, por dónde y con su identidad verificada.
  const [recipient, setRecipient] = useState("");
  const [channel, setChannel] = useState("");
  const [verified, setVerified] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<ExportResult | null>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    start(async () => {
      setResult(
        await request({
          dataset,
          reason,
          recipient,
          channel,
          identityVerified: verified,
          from: from ? new Date(`${from}T00:00:00Z`).toISOString() : undefined,
          to: to ? new Date(`${to}T23:59:59Z`).toISOString() : undefined,
        }),
      );
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <SelectField label="Conjunto de datos" value={dataset} onChange={(e) => setDataset(e.target.value)}>
        <option value="accounts">Cuentas</option>
        <option value="couriers">Repartidores</option>
        <option value="audit">Auditoría</option>
        <option value="login_events">Inicios de sesión</option>
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Field label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <TextareaField label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mínimo 10 caracteres" required />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Destinatario" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Nombre o cargo de quien la recibe" required />
        <Field label="Canal de envío" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Correo cifrado, entrega en persona…" required />
      </div>
      <label className="flex items-start gap-3 text-[13px] font-bold text-tinta">
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-hoja" />
        Verifiqué la identidad del destinatario antes de exportar.
      </label>
      {result && !result.ok ? <Alert tone="error">{result.error}</Alert> : null}
      {result?.ok ? (
        <Alert>
          <p>
            Exportación lista ({result.count} registros). El archivo vence en 15 minutos y está cifrado.
          </p>
          <p className="mt-2">
            Frase para abrirlo (se muestra una sola vez): <code className="break-all font-bold">{result.passphrase}</code>
          </p>
          <a href={result.url} rel="noopener noreferrer" className="mt-2 inline-block font-bold underline">
            Descargar archivo
          </a>
        </Alert>
      ) : null}
      <Button variant="primary" type="submit" disabled={pending || reason.trim().length < 10 || recipient.trim().length < 3 || channel.trim().length < 3 || !verified} className="self-start">
        {pending ? "Generando…" : "Exportar"}
      </Button>
    </form>
  );
}
