"use client";

import { Alert, Button } from "@rapitrip/ui";
import { CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

type Props = {
  checkoutId: string;
  pay: (checkoutId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string; expired?: boolean }>;
};

/** Paga toda la compra con tarjeta: una sola sesión de Stripe para todos sus pedidos. */
export function PayPurchase({ checkoutId, pay }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);

  function go() {
    if (busy.current) return;
    busy.current = true;
    setMessage(null);
    start(async () => {
      try {
        const result = await pay(checkoutId);
        if (!result.ok && result.expired) {
          router.replace(`/ingresar?next=${encodeURIComponent(`/compras/${checkoutId}`)}&expirada=1`);
          return;
        }
        if (!result.ok) return setMessage(result.error);
        // Navegación (no formulario): la CSP bloquea enviar formularios fuera del sitio.
        window.location.assign(result.url);
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {message ? <Alert tone="error">{message}</Alert> : null}
      <Button variant="primary" disabled={pending} onClick={go} className="self-start">
        <CreditCard aria-hidden="true" className="size-4" />
        {pending ? "Abriendo el pago…" : "Pagar con tarjeta"}
      </Button>
    </div>
  );
}
