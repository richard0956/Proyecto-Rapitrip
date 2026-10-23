import { Alert, Card } from "@rapitrip/ui";
import { ShieldCheck } from "lucide-react";

/**
 * Código de 4 dígitos que el cliente le dice al repartidor al recibir. Prueba que el pedido llegó a quien lo pidió: sin él, el
 * repartidor no puede cerrar la entrega. Solo se muestra mientras el pedido va en camino.
 */
export function DeliveryCodeCard({ code }: { code: string }) {
  return (
    <Card className="border-2 border-hoja p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-tinta">
        <ShieldCheck aria-hidden="true" className="size-5 text-hoja" />
        Tu código de entrega
      </h2>
      <p className="mt-3 text-[14px] text-tinta">Díctaselo al repartidor cuando tengas tu pedido en la mano.</p>
      <p aria-label={`Código de entrega ${code.split("").join(" ")}`} className="mt-3 rounded-panel bg-menta py-4 text-center font-mono text-[40px] font-extrabold tracking-[0.4em] text-selva">
        {code}
      </p>
      <Alert tone="warning" className="mt-4">
        No lo compartas antes de recibir tu pedido, ni por mensaje. Solo el repartidor que te entrega lo necesita.
      </Alert>
    </Card>
  );
}
