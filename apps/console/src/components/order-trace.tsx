"use client";

import { Alert, Badge, Button, Card, CardHeader } from "@rapitrip/ui";
import { Banknote, Camera, CircleAlert, Clock, MessageSquareWarning, Send, Truck } from "lucide-react";
import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { cashDifference, type TraceEntry } from "@/lib/order-trace";
import type { TraceResult } from "@/lib/order-trace-server";

const when = new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Managua" });
const icons = { estado: Truck, oferta: Send, evidencia: Camera, aviso: MessageSquareWarning } as const;

function Entry({ entry }: { entry: TraceEntry }) {
  const Icon = icons[entry.kind];
  return (
    <li className="flex gap-3 py-2.5">
      <span aria-hidden="true" className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${entry.alert ? "bg-durazno text-durazno-texto" : "bg-menta text-hoja"}`}>
        {entry.alert ? <CircleAlert className="size-4" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0 text-sm">
        <span className="block font-bold text-tinta">{entry.title}</span>
        {entry.detail ? <span className="block text-xs text-tinta-suave">{entry.detail}</span> : null}
        <span className="block text-xs text-tinta-suave">{when.format(new Date(entry.at))}</span>
      </span>
    </li>
  );
}

/**
 * Historial completo de un pedido: cambios de estado, propuestas, evidencias (con sus fotos), avisos del repartidor y, si fue en
 * efectivo, lo cobrado. Se carga al pedirlo porque las fotos llevan enlaces que vencen a los 5 minutos.
 */
export function OrderTrace({ orderId, load }: { orderId: string; load: (id: string) => Promise<TraceResult> }) {
  const [result, setResult] = useState<TraceResult | null>(null);
  const [pending, start] = useTransition();

  function open() {
    start(async () => setResult(await load(orderId)));
  }

  if (!result) {
    return (
      <Button variant="secondary" onClick={open} disabled={pending} className="self-start">
        <Clock className="size-4" aria-hidden="true" />
        {pending ? "Cargando…" : "Ver historial y evidencias"}
      </Button>
    );
  }
  if (!result.ok) {
    return (
      <Alert tone="error">
        {result.error}{" "}
        <button type="button" onClick={open} className="font-bold underline">
          Reintentar
        </button>
      </Alert>
    );
  }

  const alerts = result.entries.filter((entry) => entry.alert).length;
  const difference = result.cash ? cashDifference(result.cash) : null;
  return (
    <Card className="p-4">
      <CardHeader title="Historial y evidencias" subtitle="De la propuesta a la entrega" actions={alerts > 0 ? <Badge tone="warning">{alerts} por revisar</Badge> : <Badge tone="positive">Sin alertas</Badge>} />
      {result.cash ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-panel bg-calido/60 p-3 text-sm">
          <Banknote className="size-4 shrink-0" aria-hidden="true" />
          <span>Total {formatMoney(result.cash.total)}</span>
          {result.cash.collected !== null ? <span>Cobrado {formatMoney(result.cash.collected)}</span> : <span className="text-tinta-suave">Aún sin cobro registrado</span>}
          {difference !== null && difference !== 0 ? <Badge tone="warning">{difference < 0 ? `Faltan ${formatMoney(-difference)}` : `Sobran ${formatMoney(difference)}`}</Badge> : null}
          {result.cash.code ? <span className="font-mono text-xs">{result.cash.code}</span> : null}
          {result.cash.receivedAt ? <Badge tone="positive">Recibido en caja</Badge> : result.cash.code ? <Badge tone="warning">Pendiente de caja</Badge> : null}
        </div>
      ) : null}
      {result.photos.length > 0 ? (
        <ul className="mb-3 grid grid-cols-2 gap-3">
          {result.photos.map((photo) => (
            <li key={photo.id} className="overflow-hidden rounded-panel border border-borde">
              {photo.url ? (
                <a href={photo.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                  <img src={photo.url} alt={`${photo.label}, ${when.format(new Date(photo.takenAt))}`} loading="lazy" className="h-32 w-full object-cover" />
                </a>
              ) : (
                <p className="flex h-32 items-center justify-center bg-calido/60 px-3 text-center text-xs text-tinta-suave">{photo.purged ? "Foto eliminada por antigüedad" : "Foto no disponible"}</p>
              )}
              <p className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                <span className="font-bold text-tinta">{photo.label}</span>
                {photo.alert ? <Badge tone="warning">Revisar</Badge> : null}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="flex flex-col divide-y divide-borde">
        {result.entries.map((entry, index) => (
          <Entry key={`${entry.at}-${index}`} entry={entry} />
        ))}
      </ol>
      <p className="mt-2 text-[11.5px] text-tinta-suave">Los enlaces de las fotos vencen a los 5 minutos: vuelve a abrir esta sección si hace falta.</p>
    </Card>
  );
}
