"use client";

import { Alert, Badge, Button, Card, CardHeader, EmptyState, KpiCard } from "@rapitrip/ui";
import { Banknote, Scale, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { cashStatus, summarizeCash } from "@/lib/courier-cash";
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
  const summary = useMemo(() => summarizeCash(rows), [rows]);

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={<Wallet className="size-5" />} tone="durazno" label="Por rendir en caja" value={formatMoney(summary.pending)} hint={`${summary.pendingOrders} pedido${summary.pendingOrders === 1 ? "" : "s"}`} />
        <KpiCard icon={<Banknote className="size-5" />} label="Recibido en caja" value={formatMoney(summary.received)} hint={`${summary.receivedOrders} pedido${summary.receivedOrders === 1 ? "" : "s"}`} />
        <KpiCard icon={<Scale className="size-5" />} tone="lavanda" label="Diferencias" value={formatMoney(summary.difference)} hint={summary.differences === 0 ? "Todo coincide" : `${summary.differences} pedido${summary.differences === 1 ? "" : "s"} no coinciden`} />
      </div>
      <Card className="p-5">
        <CardHeader title="Entregas en efectivo" subtitle="Cada entrega genera un código de cobro que el cajero usa al recibir el efectivo." />
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
                    <Badge tone="warning">Pendiente de caja</Badge>
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
