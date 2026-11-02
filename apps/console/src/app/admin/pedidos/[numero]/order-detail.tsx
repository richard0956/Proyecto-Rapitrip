"use client";

import { Button } from "@rapitrip/ui";
import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrderRoute } from "@/components/order-route";
import { OrderTrace } from "@/components/order-trace";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import type { RouteResult } from "@/lib/order-route";
import type { TraceResult } from "@/lib/order-trace-server";

/** Mapa de la ruta tienda → cliente (se carga al abrir la ficha). */
export function RouteSection({ orderId, load }: { orderId: string; load: (id: string) => Promise<RouteResult> }) {
  return <OrderRoute orderId={orderId} load={load} />;
}

/** Historial de estados, evidencias y cobro, a pedido (las fotos se firman por 5 minutos). */
export function TraceSection({ orderId, load }: { orderId: string; load: (id: string) => Promise<TraceResult> }) {
  return (
    <div className="flex flex-col">
      <OrderTrace orderId={orderId} load={load} />
    </div>
  );
}

/** Cancelar como excepción: pide motivo, devuelve el stock y encola el reembolso si estaba pagado con tarjeta. */
export function CancelOrderButton({ id, number, cancel }: { id: string; number: number; cancel: (id: string, reason: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Button variant="danger" onClick={() => setAsking(true)} className="w-full">
        <XCircle className="size-4" aria-hidden="true" />
        Cancelar pedido
      </Button>
      {asking ? (
        <ReasonDialog
          open
          onClose={() => setAsking(false)}
          title={`Cancelar pedido ${number}`}
          description="Se devuelve el stock. Si ya estaba pagado con tarjeta, se encola el reembolso al cliente."
          confirmLabel="Cancelar pedido"
          danger
          onConfirm={async (reason) => {
            const result = await cancel(id, reason);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
    </>
  );
}
