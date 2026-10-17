"use client";

import { Button } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";

export function CancelInvitationButton({ id, email, cancel }: { id: string; email: string; cancel: (input: { id: string }) => Promise<ActionResult> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span>
      <Button
        variant="ghost"
        className="min-h-9 px-3"
        disabled={pending}
        aria-label={`Cancelar la invitación de ${email}`}
        onClick={() =>
          start(async () => {
            const result = await cancel({ id });
            if (!result.ok) return setError(result.error);
            router.refresh();
          })
        }
      >
        {pending ? "Cancelando…" : "Cancelar"}
      </Button>
      {error ? <span role="alert" className="ml-2 text-sm font-bold">{error}</span> : null}
    </span>
  );
}
