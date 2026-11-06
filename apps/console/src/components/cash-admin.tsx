"use client";

import { Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, Field } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";
import type { CashierOption, CashSettings, RegisterRow } from "@/lib/load-cash-control";
import { formatMoney } from "@/lib/money";

type Message = { ok: boolean; text: string } | null;

/** Límites del efectivo: minutos para confirmar una entrega y lo máximo que un repartidor puede llevar encima. */
export function CashSettingsCard({ settings, save }: { settings: CashSettings; save: (input: CashSettings) => Promise<ActionResult> }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(String(settings.confirmMinutes));
  const [hours, setHours] = useState(String(settings.maxHoldHours));
  const [amount, setAmount] = useState(String(settings.maxHoldAmount));
  const [message, setMessage] = useState<Message>(null);
  const [busy, run] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    run(async () => {
      const result = await save({ confirmMinutes: Number(minutes), maxHoldHours: Number(hours), maxHoldAmount: Number(amount) });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setMessage({ ok: true, text: "Límites guardados." });
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Límites del efectivo" subtitle="Pasado el monto o el tiempo máximo, el repartidor no recibe pedidos nuevos en efectivo hasta entregarlo." />
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Minutos para confirmar" type="number" inputMode="numeric" min="5" max="60" value={minutes} onChange={(e) => setMinutes(e.target.value)} hint="De 5 a 60" />
          <Field label="Horas máximas con efectivo" type="number" inputMode="numeric" min="1" max="24" value={hours} onChange={(e) => setHours(e.target.value)} hint="De 1 a 24" />
          <Field label="Monto máximo encima" type="number" inputMode="decimal" min="100" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} hint="Por repartidor" />
        </div>
        {message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}
        <Button variant="primary" type="submit" disabled={busy} className="self-start">
          {busy ? "Guardando…" : "Guardar límites"}
        </Button>
      </form>
    </Card>
  );
}

type RegisterInput = { id?: string; name: string; code?: string; cashierId: string | null; active: boolean };

/** Cajas físicas: cada estación de trabajo con su código y, si se quiere, su cajero. Un turno se abre en una caja. */
export function RegistersCard({ registers, cashiers, save }: { registers: RegisterRow[]; cashiers: CashierOption[]; save: (input: RegisterInput) => Promise<ActionResult> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RegisterRow | "nueva" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();

  function edit(target: RegisterRow | "nueva") {
    setEditing(target);
    setError(null);
    setName(target === "nueva" ? "" : target.name);
    setCode(target === "nueva" ? "" : target.code);
    setCashierId(target === "nueva" ? "" : (target.cashierId ?? ""));
    setActive(target === "nueva" ? true : target.active);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    run(async () => {
      const result = await save(editing === "nueva" ? { name, code, cashierId: cashierId || null, active: true } : { id: editing.id, name, cashierId: cashierId || null, active });
      if (!result.ok) return setError(result.error);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Cajas físicas"
        subtitle="Cada cajero trabaja en su propia caja. Lo contado al cerrar queda como saldo inicial de esa caja."
        actions={
          <Button variant="secondary" className="min-h-9 shrink-0 whitespace-nowrap px-3" onClick={() => edit("nueva")}>
            Nueva caja
          </Button>
        }
      />
      {registers.length === 0 ? (
        <EmptyState title="Sin cajas registradas">Registra una caja por cada estación de trabajo con su gaveta.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {registers.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">
                  {row.name} <span className="font-mono text-xs font-semibold text-tinta-suave">· {row.code}</span>
                </span>
                <span className="block text-xs text-tinta-suave">
                  {row.cashierName ? `Asignada a ${row.cashierName}` : "Sin cajero asignado"}
                  {row.lastCounted !== null ? ` · último cierre ${formatMoney(row.lastCounted)}` : ""}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {!row.active ? <Badge tone="neutral">Inactiva</Badge> : row.openBy ? <Badge tone="positive">Abierta por {row.openBy}</Badge> : <Badge tone="neutral">Cerrada</Badge>}
                <Button variant="ghost" className="min-h-9 px-3" onClick={() => edit(row)}>
                  Editar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "nueva" ? "Nueva caja" : "Editar caja"}>
        <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
          <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Caja 1" />
          {editing === "nueva" ? (
            <Field label="Código de la estación" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} placeholder="CAJA-01" hint="De 3 a 12 letras, números o guiones. No se cambia después." />
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm font-bold text-tinta">
            Cajero asignado
            <select value={cashierId} onChange={(e) => setCashierId(e.target.value)} className="min-h-11 rounded-campo border border-borde-campo bg-papel px-3 text-sm font-semibold text-tinta">
              <option value="">Sin asignar (cualquier cajero)</option>
              {cashiers.map((cashier) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.name}
                </option>
              ))}
            </select>
          </label>
          {editing !== "nueva" ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-tinta">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-hoja" />
              Caja activa
            </label>
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={busy || name.trim().length < 2 || (editing === "nueva" && code.trim().length < 3)}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
