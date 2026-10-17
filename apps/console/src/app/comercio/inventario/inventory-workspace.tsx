"use client";

import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, pillStyles, SelectField } from "@rapitrip/ui";
import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-error";

type StockState = "sin_control" | "agotado" | "bajo" | "disponible";
export type InventoryRow = { variantId: string; storeId: string; product: string; variant: string; sku: string; productStatus: string; active: boolean; track: boolean; quantity: number; threshold: number; state: StockState };
export type Movement = { variantId: string; kind: "entrada" | "salida" | "conteo"; delta: number; after: number; reason: string; when: string };

const stateLabel: Record<StockState, string> = { sin_control: "Sin control", agotado: "Agotado", bajo: "Stock bajo", disponible: "Disponible" };
const stateTone: Record<StockState, "neutral" | "danger" | "warning" | "positive"> = { sin_control: "neutral", agotado: "danger", bajo: "warning", disponible: "positive" };
const filters = [
  { key: "alertas", label: "Requieren atención" },
  { key: "todos", label: "Todos" },
  { key: "sin_control", label: "Sin control" },
] as const;
type Filter = (typeof filters)[number]["key"];

type Props = {
  stores: { id: string; name: string }[];
  rows: InventoryRow[];
  history: Movement[];
  setTracking: (variantId: string, input: { track: boolean; threshold: number }) => Promise<ActionResult>;
  change: (variantId: string, input: { kind: Movement["kind"]; amount: number; reason: string }) => Promise<ActionResult>;
};

export function InventoryWorkspace({ stores, rows, history, setTracking, change }: Props) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? null);
  const [filter, setFilter] = useState<Filter>("alertas");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const forStore = useMemo(() => rows.filter((row) => row.storeId === storeId), [rows, storeId]);
  const alerts = forStore.filter((row) => row.state === "agotado" || row.state === "bajo").length;
  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return forStore.filter((row) => {
      if (filter === "alertas" && row.state !== "agotado" && row.state !== "bajo") return false;
      if (filter === "sin_control" && row.state !== "sin_control") return false;
      return !text || `${row.product} ${row.variant} ${row.sku}`.toLowerCase().includes(text);
    });
  }, [forStore, filter, query]);
  const current = rows.find((row) => row.variantId === selected) ?? null;

  if (stores.length === 0) {
    return (
      <Card>
        <EmptyState title="Primero crea una tienda">
          El inventario es por tienda.{" "}
          <Link href="/comercio/tiendas" className="font-bold text-hoja underline underline-offset-2">
            Ir a Mis tiendas
          </Link>
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      {stores.length > 1 ? (
        <div role="tablist" aria-label="Tienda activa" className="mb-4 flex flex-wrap gap-2">
          {stores.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={storeId === item.id} onClick={() => setStoreId(item.id)} className={pillStyles(storeId === item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      {alerts > 0 ? (
        <Alert tone="warning" className="mb-4">
          {alerts} {alerts === 1 ? "variante necesita" : "variantes necesitan"} reposición (agotadas o con stock bajo).
        </Alert>
      ) : null}
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Filtro" className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={pillStyles(filter === item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="min-w-[220px] flex-1">
          <Field label="Buscar" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por producto o SKU" />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={forStore.length === 0 ? "Esta tienda no tiene variantes" : filter === "alertas" ? "Todo en orden" : "Sin resultados"}>
          {forStore.length === 0 ? "Crea productos con variantes en el catálogo." : filter === "alertas" ? "Ninguna variante está agotada ni con stock bajo." : "Prueba con otro filtro o búsqueda."}
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {visible.map((row) => (
            <li key={row.variantId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-tinta">
                  {row.product} <span className="font-medium text-tinta-suave">· {row.variant}</span>
                </p>
                <p className="text-xs text-tinta-suave">
                  SKU {row.sku}
                  {row.productStatus !== "publicado" ? " · producto en borrador" : ""}
                  {!row.active ? " · variante inactiva" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 text-right text-sm font-bold tabular-nums text-tinta">{row.track ? row.quantity : "—"}</span>
                <Badge tone={stateTone[row.state]}>{stateLabel[row.state]}</Badge>
                <Button variant="secondary" onClick={() => setSelected(row.variantId)} aria-label={`Ajustar ${row.product}, ${row.variant}`} className="min-h-10 px-3">
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  Ajustar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {current ? <AdjustDialog key={current.variantId} row={current} history={history.filter((item) => item.variantId === current.variantId).slice(0, 8)} onClose={() => setSelected(null)} setTracking={setTracking} change={change} /> : null}
    </Card>
  );
}

function AdjustDialog({ row, history, onClose, setTracking, change }: { row: InventoryRow; history: Movement[]; onClose: () => void; setTracking: Props["setTracking"]; change: Props["change"] }) {
  const router = useRouter();
  const [track, setTrack] = useState(row.track);
  const [threshold, setThreshold] = useState(String(row.threshold));
  const [kind, setKind] = useState<Movement["kind"]>("entrada");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function saveTracking(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await setTracking(row.variantId, { track, threshold: Number(threshold) });
      setMessage(result.ok ? { ok: true, text: "Control guardado." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await change(row.variantId, { kind, amount: Number(amount), reason });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setAmount("");
      setReason("");
      setMessage({ ok: true, text: "Movimiento registrado." });
      router.refresh();
    });
  }

  return (
    <Dialog open onClose={onClose} title={`${row.product} · ${row.variant}`}>
      <div className="flex flex-col gap-4">
        <form onSubmit={saveTracking} className="flex flex-col gap-3" noValidate>
          <label className="flex min-h-11 items-center gap-2.5 text-sm font-bold text-tinta">
            <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} className="size-4 accent-[var(--hoja)]" />
            Controlar stock de esta variante
          </label>
          {track ? <Field label="Avisar cuando queden" type="number" inputMode="numeric" min="0" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} hint="Unidades o menos: stock bajo" /> : <p className="text-xs text-tinta-suave">Sin control, la variante se vende sin límite.</p>}
          <Button variant="secondary" type="submit" disabled={pending} className="self-start">
            Guardar control
          </Button>
        </form>
        {row.track ? (
          <form onSubmit={submit} className="flex flex-col gap-3 rounded-panel bg-calido/50 p-4" noValidate>
            <p className="text-sm font-bold text-tinta">
              Existencias: <span className="tabular-nums">{row.quantity}</span>
            </p>
            <SelectField label="Movimiento" value={kind} onChange={(e) => setKind(e.target.value as Movement["kind"])}>
              <option value="entrada">Entrada (suma)</option>
              <option value="salida">Salida (resta)</option>
              <option value="conteo">Conteo físico (fija la cantidad)</option>
            </SelectField>
            <Field label={kind === "conteo" ? "Cantidad contada" : "Cantidad"} type="number" inputMode="numeric" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Field label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} hint="Mínimo 5 caracteres. Queda en el historial." />
            <Button variant="primary" type="submit" disabled={pending || amount === "" || reason.trim().length < 5} className="self-start">
              {pending ? "Guardando…" : "Registrar movimiento"}
            </Button>
          </form>
        ) : null}
        {message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null}
        {history.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-bold text-tinta-suave">Últimos movimientos</p>
            <ul className="flex flex-col divide-y divide-borde text-xs">
              {history.map((item, index) => (
                <li key={index} className="flex items-start justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-bold text-tinta">{item.kind === "entrada" ? "Entrada" : item.kind === "salida" ? "Salida" : "Conteo"}: {item.delta > 0 ? `+${item.delta}` : item.delta} → {item.after}</span>
                    <span className="block truncate text-tinta-suave">{item.reason}</span>
                  </span>
                  <span className="shrink-0 text-tinta-suave">{item.when}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
