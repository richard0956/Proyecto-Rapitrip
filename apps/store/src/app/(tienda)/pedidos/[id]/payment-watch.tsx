"use client";

import { Alert } from "@rapitrip/ui";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { AutoRefresh } from "./auto-refresh";

/**
 * Regreso de Stripe con `?pago=ok` y el pedido todavía sin pagar: el webhook puede tardar unos segundos. Nunca se afirma «pagado»
 * por la URL; se consulta el estado real cada 3 segundos (hasta 30) y, si no llega, se dice la verdad.
 */
export function PaymentWatch() {
  const [gaveUp, setGaveUp] = useState(false);
  const onExhausted = useCallback(() => setGaveUp(true), []);
  if (gaveUp) {
    return (
      <Alert tone="warning">
        Todavía no recibimos la confirmación de tu pago. Si ya pagaste, tu pedido se actualizará en unos minutos; no hace falta que pagues otra vez. Esta pantalla se actualiza sola.
      </Alert>
    );
  }
  return (
    <>
      <AutoRefresh everyMs={3000} maxAttempts={10} onExhausted={onExhausted} />
      <Alert>
        <span className="flex items-center gap-2 font-bold">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Confirmando tu pago…
        </span>
        Esto toma unos segundos.
      </Alert>
    </>
  );
}
