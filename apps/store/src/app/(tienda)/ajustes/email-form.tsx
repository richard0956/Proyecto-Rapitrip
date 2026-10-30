"use client";

import { Alert, Button, Field } from "@rapitrip/ui";
import { Mail, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { CustomerResult } from "@/lib/result";

/** Correo de la cuenta: se ve el actual y, al tocar «Cambiar», se pide el nuevo; el cambio se confirma por correo. */
export function EmailForm({ email, change }: { email: string | null; change: (input: unknown) => Promise<CustomerResult> }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    start(async () => {
      const outcome = await change({ email: value.trim() });
      if (!outcome.ok && outcome.expired) return router.replace(`/ingresar?next=${encodeURIComponent("/ajustes")}&expirada=1`);
      setResult(outcome);
      if (outcome.ok) {
        setEditing(false);
        setValue("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-crema/70 px-4 py-3 ring-1 ring-borde">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[14px] font-semibold text-tinta">{email}</span>
          <span className="shrink-0 rounded-full bg-menta px-2.5 py-1 text-[11.5px] font-bold text-exito">Confirmado</span>
        </span>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-superficie px-4 text-[13px] font-semibold text-tinta ring-1 ring-borde-campo hover:bg-crema focus-visible:outline-2 focus-visible:outline-hoja">
            <Pencil aria-hidden="true" className="size-4" />
            Cambiar
          </button>
        ) : null}
      </div>
      {editing ? (
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1">
            <Field label="Correo nuevo" icon={<Mail className="size-4" />} type="email" autoComplete="email" value={value} onChange={(e) => setValue(e.target.value)} required />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" disabled={pending || !value.trim()}>
              {pending ? "Enviando…" : "Enviar enlaces"}
            </Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setResult(null); }}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
    </div>
  );
}
