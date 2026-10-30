"use client";

import { Alert, Button, Field } from "@rapitrip/ui";
import { Smartphone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { saveDraft, takeDraft } from "@/lib/draft";
import type { CustomerResult } from "@/lib/result";

const DRAFT_KEY = "rapitrip:perfil";
type Values = { fullName: string; phone: string };

export function ProfileForm({ initial, save }: { initial: Values; save: (values: Values) => Promise<CustomerResult> }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial);
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [restored, setRestored] = useState(false);
  const [pending, start] = useTransition();

  // Tras volver a ingresar por sesión vencida, se recupera lo que el cliente había escrito.
  useEffect(() => {
    const draft = takeDraft<Values>(DRAFT_KEY);
    if (draft) {
    // Leer el borrador de sessionStorage solo es posible tras hidratar: es sincronizar con un sistema externo del navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(draft);
      setRestored(true);
    }
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    start(async () => {
      const outcome = await save(values);
      if (!outcome.ok && outcome.expired) {
        saveDraft(DRAFT_KEY, values);
        router.replace(`/ingresar?next=${encodeURIComponent("/ajustes")}&expirada=1`);
        return;
      }
      setResult(outcome);
      if (outcome.ok) {
        setRestored(false);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
      {restored ? <Alert>Recuperamos lo que escribiste. Revisa y guarda los cambios.</Alert> : null}
      <Field label="Nombre completo" icon={<UserRound className="size-4" />} autoComplete="name" value={values.fullName} onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))} required />
      <Field label="Teléfono" icon={<Smartphone className="size-4" />} type="tel" autoComplete="tel" value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} hint="Opcional. Lo usamos para coordinar tus entregas." />
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? (result.message ?? "Listo.") : result.error}</Alert> : null}
      <Button variant="primary" type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
