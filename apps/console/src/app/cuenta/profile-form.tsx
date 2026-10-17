"use client";

import { Alert, Button, Field } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

type Props = { fullName: string; phone: string; save: (input: { fullName: string; phone: string }) => Promise<ActionResult> };

export function ProfileForm({ fullName: initialName, phone: initialPhone, save }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    start(async () => {
      const outcome = await save({ fullName, phone });
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
      <Field label="Nombre completo" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <Field label="Teléfono" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? (result.message ?? "Listo.") : result.error}</Alert> : null}
      <Button variant="secondary" type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
