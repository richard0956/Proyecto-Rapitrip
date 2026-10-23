import { Card } from "@rapitrip/ui";

export type DeliveryProofData = { url: string | null; takenAt: string | null; purged: boolean };

/** Foto del paquete en el lugar de entrega, con la hora. Se conserva 3 meses; después queda solo la constancia. */
export function DeliveryProof({ proof }: { proof: DeliveryProofData }) {
  return (
    <Card className="p-6">
      <h2 className="text-base font-bold text-tinta">Constancia de entrega</h2>
      {proof.url ? (
        <>
          <img src={proof.url} alt="Foto de tu pedido en el lugar de entrega" className="mt-3 max-h-80 w-full rounded-panel object-cover" />
          {proof.takenAt ? <p className="mt-2 text-xs text-tinta-suave">Tomada el {proof.takenAt}</p> : null}
        </>
      ) : proof.purged ? (
        <p className="mt-2 text-sm text-tinta-suave">La foto de tu entrega se eliminó pasados 3 meses. Conservamos la hora y la constancia.</p>
      ) : (
        <p className="mt-2 text-sm text-tinta-suave">El repartidor registró tu entrega, pero la foto no está disponible en este momento.</p>
      )}
    </Card>
  );
}
