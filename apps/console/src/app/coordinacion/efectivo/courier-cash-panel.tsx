"use client";

import { Alert, Badge, Button, Card, CardHeader, EmptyState } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { cashStatus } from "@/lib/courier-cash";
import type { RegisterCashResult } from "./actions";

export type DeliveredCash = {
  id: string;
  number: number;
  store: string;
  total: number;
  /** Monto que el repartidor dijo haber cobrado (solo si usa la aplicación). */
  collected: number | null;
  code: string | null;
  received: boolean;
  courier: string;
  /** El repartidor tiene cuenta en la aplicación: él mismo registra el cobro. */
  hasAccount: boolean;
  deliveredAt: string;
};

export function CourierCashPanel({ rows, register }: { rows: DeliveredCash[]; register: (orderId: string) => Promise<RegisterCashResult> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(orderId: string) {
    setBusy(orderId);
    setError(null);
    const result = await register(orderId);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <CardHeader title="Pedidos entregados en efectivo" subtitle="Cada cobro tiene su código. Para un repartidor sin cuenta, regístralo aquí y después envía la entrega a caja." />
        {error ? <Alert tone="error" className="mb-4">{error}</Alert> : null}
        {rows.length === 0 ? (
          <EmptyState title="Sin entregas en efectivo">Aquí aparecen los pedidos en efectivo ya entregados.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {rows.map((row) => {
              const status = cashStatus(row);
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-bold text-tinta">
                      Pedido {row.number} · {formatMoney(row.total)}
                    </span>
                    <span className="block truncate text-xs text-tinta-suave">
                      {row.courier} · {row.store} · entregado {row.deliveredAt}
                      {row.code ? ` · código ${row.code}` : ""}
                    </span>
                    {status.difference !== null && status.difference !== 0 ? (
                      <span className="mt-1 block text-xs font-bold text-durazno-texto">
                        Cobró {formatMoney(row.collected)}: {status.difference < 0 ? `faltan ${formatMoney(-status.difference)}` : `sobran ${formatMoney(status.difference)}`}
                      </span>
                    ) : null}
                  </span>
                  {status.kind === "recibido" ? (
                    <Badge tone="positive">Recibido en caja</Badge>
                  ) : status.kind === "pendiente_caja" ? (
                    <Badge tone="warning">A cargo del repartidor</Badge>
                  ) : row.hasAccount ? (
                    <Badge tone="warning">Sin cobro registrado</Badge>
                  ) : (
                    <Button variant="secondary" onClick={() => accept(row.id)} disabled={busy !== null} className="min-h-9 px-3">
                      {busy === row.id ? "Registrando…" : "Registrar efectivo cobrado"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
