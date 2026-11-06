"use client";

import { Alert, Badge, Button, Card, CardHeader, Dialog, Field, cn } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Countdown } from "@/components/countdown";
import { ReasonDialog } from "@/components/reason-dialog";
import type { ActionResult } from "@/lib/action-error";
import { formatMoney } from "@/lib/money";
import type { HandoffResult } from "./actions";

/** Entrega de efectivo esperando al cajero. Sin monto a propósito: el cajero cuenta a ciegas. */
export type Handoff = { id: string; courier: string; orders: number[]; createdAt: string; expiresAt: string };
export type HandoffDone = { id: string; courier: string; status: "confirmada" | "con_diferencia" | "rechazada" | "vencida"; counted: number | null; difference: number | null; orders: number; at: string };

type Props = {
  pending: Handoff[];
  done: HandoffDone[];
  confirm: (input: { id: string; counted: number; note?: string }) => Promise<HandoffResult>;
  reject: (id: string, reason: string) => Promise<ActionResult>;
};

const statusBadge: Record<HandoffDone["status"], { tone: "positive" | "warning" | "danger" | "neutral"; label: string }> = {
  confirmada: { tone: "positive", label: "Confirmada" },
  con_diferencia: { tone: "warning", label: "Con diferencia" },
  rechazada: { tone: "danger", label: "Rechazada" },
  vencida: { tone: "danger", label: "Vencida" },
};

/**
 * Entregas de efectivo que los repartidores enviaron a esta caja. El cajero cuenta el dinero y escribe el monto sin ver lo
 * declarado; si no coincide, la diferencia queda a cargo del repartidor. «No lo recibí» la rechaza. Mientras haya entregas
 * esperando, la pantalla se actualiza sola.
 */
export function HandoffCard({ pending, done, confirm, reject }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<Handoff | null>(null);
  const [rejecting, setRejecting] = useState<Handoff | null>(null);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ courier: string; difference: number } | null>(null);
  const [busy, start] = useTransition();

  // Las entregas llegan sin aviso: se revisa cada 20 segundos mientras el turno está abierto.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [router]);

  function dismiss() {
    setTarget(null);
    setCounted("");
    setNote("");
    setError(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!target) return;
    setError(null);
    start(async () => {
      const response = await confirm({ id: target.id, counted: Number(counted), note: note.trim() || undefined });
      if (!response.ok) return setError(response.error);
      setResult({ courier: target.courier, difference: response.difference });
      dismiss();
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader
        title="Efectivo de repartidores"
        subtitle="Cuenta el efectivo que te entrega cada repartidor y escribe el monto. Tienes un tiempo límite para confirmarlo."
        actions={<span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums", pending.length > 0 ? "bg-durazno text-durazno-texto" : "bg-crema text-tinta-suave")}>{pending.length}</span>}
      />
      {result ? (
        <div className="mb-3">
          <Alert tone={result.difference === 0 ? "info" : "warning"}>
            {result.difference === 0
              ? `Entrega de ${result.courier} confirmada: el monto cuadra.`
              : `Entrega de ${result.courier} confirmada con ${result.difference < 0 ? "faltante" : "sobrante"} de ${formatMoney(Math.abs(result.difference))}. Queda a cargo del repartidor y la revisa administración.`}
          </Alert>
        </div>
      ) : null}
      {pending.length === 0 ? (
        <p className="text-[13px] text-tinta-suave">Ningún repartidor está entregando efectivo a tu caja ahora.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {pending.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block font-bold text-tinta">{item.courier}</span>
                  <span className="block text-xs text-tinta-suave">
                    {item.orders.length === 1 ? "Pedido" : "Pedidos"} {item.orders.join(", ")}
                  </span>
                </span>
                <Countdown until={item.expiresAt} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" className="min-h-9 px-3" onClick={() => setTarget(item)} disabled={busy}>
                  Contar y confirmar
                </Button>
                <Button variant="ghost" className="min-h-9 px-3 text-rojo hover:bg-rosa" onClick={() => setRejecting(item)} disabled={busy}>
                  No lo recibí
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 ? (
        <div className="mt-4 border-t border-borde pt-3">
          <p className="mb-1.5 text-micro font-bold uppercase text-tinta-suave">Entregas de este turno</p>
          <ul className="flex flex-col divide-y divide-borde">
            {done.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span className="min-w-0">
                  <span className="block font-semibold text-tinta">{item.courier}</span>
                  <span className="block text-xs text-tinta-suave">
                    {item.at} · {item.orders} {item.orders === 1 ? "pedido" : "pedidos"}
                    {item.counted !== null ? ` · contado ${formatMoney(item.counted)}` : ""}
                    {item.difference ? ` · diferencia ${formatMoney(item.difference)}` : ""}
                  </span>
                </span>
                <Badge tone={statusBadge[item.status].tone}>{statusBadge[item.status].label}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={target !== null} onClose={dismiss} title={target ? `Efectivo de ${target.courier}` : "Confirmar efectivo"}>
        <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
          <p className="text-sm text-tinta-suave">
            Cuenta los billetes y monedas delante del repartidor y escribe el total. No mostramos lo que él declaró: si no coincide, la diferencia queda a su cargo.
          </p>
          {target ? (
            <div>
              <Countdown until={target.expiresAt} />
            </div>
          ) : null}
          <Field label="Efectivo contado" type="number" inputMode="decimal" min="0" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
          <Field label="Nota" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} hint="Opcional: por ejemplo, un billete dañado" />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={dismiss} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={busy || counted === ""}>
              {busy ? "Confirmando…" : "Confirmar efectivo"}
            </Button>
          </div>
        </form>
      </Dialog>

      {rejecting ? (
        <ReasonDialog
          open
          onClose={() => setRejecting(null)}
          title={`Rechazar la entrega de ${rejecting.courier}`}
          description="Úsalo si el repartidor no llegó a tu caja o no te dio el efectivo. El dinero sigue a su cargo y coordinación recibe el caso."
          confirmLabel="Rechazar entrega"
          danger
          onConfirm={(reason) => reject(rejecting.id, reason)}
        />
      ) : null}
    </Card>
  );
}
