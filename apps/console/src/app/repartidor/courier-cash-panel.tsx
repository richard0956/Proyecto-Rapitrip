"use client";

import { Alert, Badge, Button, Card, CardHeader, EmptyState } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import type { RegisterCashResult } from "./actions";

export type DeliveredCash = { id: string; number: number; store: string; total: number; code: string | null; received: boolean; courier: string; deliveredAt: string };

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
    <Card className="p-5">
      <CardHeader title="Entregas en efectivo" subtitle="Cada entrega genera un código de cobro que el cajero usa al recibir el efectivo." />
      {error ? <Alert tone="error" className="mb-4">{error}</Alert> : null}
      {rows.length === 0 ? (
        <EmptyState title="Sin entregas en efectivo">Aquí aparecen los pedidos en efectivo ya entregados.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">Pedido {row.number} · {formatMoney(row.total)}</span>
                <span className="block truncate text-xs text-tinta-suave">
                  {row.courier} · {row.store} · entregado {row.deliveredAt}{row.code ? ` · código ${row.code}` : ""}
                </span>
              </span>
              {row.received ? (
                <Badge tone="positive">Recibido en caja</Badge>
              ) : row.code ? (
                <Badge tone="warning">Pendiente de caja</Badge>
              ) : (
                <Button variant="secondary" onClick={() => accept(row.id)} disabled={busy !== null} className="min-h-9 px-3">
                  {busy === row.id ? "Registrando…" : "Registrar efectivo cobrado"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
