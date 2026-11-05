import { Alert } from "@rapitrip/ui";
import { Clock } from "lucide-react";
import Link from "next/link";

export type StalledOrder = { id: string; number: string; store_name: string | null; status: string; minutes: number };

const statusText: Record<string, string> = { confirmado: "confirmado", preparando: "en preparación" };

/**
 * Control 6.1.1 del manual de políticas de TI: pedidos en preparación sin cambio de estado por más de 30 minutos. Quien da
 * seguimiento contacta al comercio para conocer la causa. Sin pedidos así, no se muestra nada.
 */
export function StalledOrders({ rows, basePath }: { rows: StalledOrder[]; basePath: string }) {
  if (rows.length === 0) return null;
  const shown = rows.slice(0, 5);
  return (
    <Alert tone="warning" className="mb-5">
      <span className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2 font-bold">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          {rows.length === 1 ? "1 pedido lleva más de 30 minutos sin avanzar" : `${rows.length} pedidos llevan más de 30 minutos sin avanzar`}
        </span>
        <span className="text-[12.5px]">Contacta al comercio para conocer la causa y deja constancia en el pedido.</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {shown.map((row) => (
            <Link key={row.id} href={`${basePath}/${encodeURIComponent(row.number)}`} className="font-bold underline underline-offset-2">
              {row.number} · {row.store_name ?? "Comercio"} · {statusText[row.status] ?? row.status} hace {row.minutes} min
            </Link>
          ))}
          {rows.length > shown.length ? <span>y {rows.length - shown.length} más</span> : null}
        </span>
      </span>
    </Alert>
  );
}
