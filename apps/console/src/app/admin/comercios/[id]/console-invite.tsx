"use client";

import { Alert, Button, Field } from "@rapitrip/ui";
import { Mail, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";

/**
 * Invitar (o volver a invitar) la cuenta de consola de un comercio. Zero Trust: un correo sin cuenta en Rapitrip, distinto del
 * de la tienda de quien lo pidió. La invitación anterior, si la hay, se cancela.
 */
export function ConsoleInvite({ commerceId, defaultEmail, pending: hasPending, invite }: { commerceId: string; defaultEmail: string; pending: boolean; invite: (id: string, email: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        start(async () => {
          const outcome = await invite(commerceId, email.trim());
          setResult(outcome);
          if (outcome.ok) router.refresh();
        });
      }}
    >
      <Field label="Correo para la consola" type="email" required icon={<Mail className="size-4" />} value={email} onChange={(e) => setEmail(e.target.value)} hint="Sin cuenta en Rapitrip y distinto del de la tienda." />
      <Button type="submit" variant={hasPending ? "secondary" : "primary"} disabled={busy || email.trim() === ""}>
        <Send aria-hidden="true" className="size-4" />
        {busy ? "Enviando…" : hasPending ? "Reenviar invitación" : "Enviar invitación"}
      </Button>
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? (result.message ?? "Invitación enviada.") : result.error}</Alert> : null}
    </form>
  );
}
