"use client";

import { Alert, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { AtSign, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";

/**
 * Dominios de correo institucional: el equipo (administración, caja y coordinación) solo se invita con un correo de esta
 * lista. La dirección la edita; la administración la ve.
 */
export function DomainsCard({ domains, canEdit, add, remove }: { domains: string[]; canEdit: boolean; add: (domain: string) => Promise<ActionResult>; remove: (domain: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, start] = useTransition();

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setResult(null);
    start(async () => {
      const outcome = await action();
      setResult(outcome.ok ? null : outcome);
      if (outcome.ok) {
        onOk?.();
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Correos institucionales" subtitle="El equipo solo se invita con un correo de estos dominios. Cada cuenta es de una sola app: nunca la de la tienda ni la del repartidor." />
      {domains.length === 0 ? (
        <Alert tone="warning">Todavía no hay dominios: no se puede invitar a nadie del equipo hasta que la dirección agregue el de Rapitrip.</Alert>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <li key={domain} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-menta/60 pl-3.5 pr-1.5 text-[13px] font-bold text-tinta ring-1 ring-menta-borde">
              <AtSign aria-hidden="true" className="size-3.5 text-hoja" />
              {domain}
              {canEdit ? (
                <button type="button" disabled={busy} onClick={() => run(() => remove(domain))} aria-label={`Quitar ${domain}`} className="flex size-7 items-center justify-center rounded-full text-tinta-suave hover:bg-papel hover:text-rojo focus-visible:outline-2 focus-visible:outline-hoja">
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : (
                <span className="w-1.5" />
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => add(value), () => setValue(""));
          }}
        >
          <Field label="Agregar dominio" placeholder="rapitrip.com" value={value} onChange={(e) => setValue(e.target.value)} className="sm:flex-1" />
          <Button type="submit" disabled={busy || value.trim() === ""}>
            <Plus aria-hidden="true" className="size-4" />
            Agregar
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-[12.5px] text-tinta-suave">Solo la dirección agrega o quita dominios.</p>
      )}
      {result && !result.ok ? <Alert tone="error" className="mt-3">{result.error}</Alert> : null}
    </Card>
  );
}
