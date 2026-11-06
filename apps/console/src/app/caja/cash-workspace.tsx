"use client";

import { Alert, Badge, Button, Card, CardHeader, DataTable, Dialog, EmptyState, Field, cn, pillStyles, type Column } from "@rapitrip/ui";
import { Banknote, CreditCard, Lock, Minus, Plus, Receipt, Search, ShoppingCart, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ReasonDialog } from "@/components/reason-dialog";
import { SearchableSelect } from "@/components/searchable-select";
import type { ActionResult } from "@/lib/action-error";
import { formatMoney } from "@/lib/money";
import type { CashIncident, CloseResult, HandoffResult } from "./actions";
import { HandoffCard, type Handoff, type HandoffDone } from "./handoff-card";

export type { Handoff, HandoffDone };

export type CatalogRow = { storeId: string; storeName: string; variantId: string; product: string; variant: string; sku: string; price: number; quantity: number | null };
export type Sale = { id: string; number: number; store: string; voided: boolean; method: "efectivo" | "tarjeta"; total: number; at: string };
export type Shift = { id: string; openedAt: string; opening: number; closed: boolean; difference: number | null; note: string | null; salesCount: number; salesTotal: number; register: string | null };
export type Register = { id: string; name: string; code: string; mine: boolean; lastCounted: number | null };
export type CashReturn = { requestId: string; orderNumber: number; store: string; total: number; decidedAt: string };

type Actions = {
  openCashSession: (input: { opening: number | null; registerId: string | null }) => Promise<ActionResult>;
  closeCashSession: (input: { counted: number; note?: string }) => Promise<CloseResult>;
  createCounterSale: (input: { store: string; method: "efectivo" | "tarjeta"; reference?: string; items: { variant_id: string; quantity: number }[] }) => Promise<ActionResult>;
  voidCounterSale: (id: string, reason: string) => Promise<ActionResult>;
  confirmCashHandoff: (input: { id: string; counted: number; note?: string }) => Promise<HandoffResult>;
  rejectCashHandoff: (id: string, reason: string) => Promise<ActionResult>;
  returnCashToCustomer: (requestId: string) => Promise<ActionResult>;
  loadCashIncidents: (sessionId: string) => Promise<{ ok: true; incidents: CashIncident[] } | { ok: false; error: string }>;
};

type Message = { ok: boolean; text: string } | null;
const Feedback = ({ message }: { message: Message }) => (message ? <Alert tone={message.ok ? "info" : "error"}>{message.text}</Alert> : null);

/**
 * Con el turno abierto: arriba la barra del turno (cifras, «Nueva venta» y «Cerrar caja»); «Nueva venta» se despliega cuando se
 * va a cobrar; debajo, las ventas del turno con filtros y, al lado, lo que entra o sale de caja por repartidores y devoluciones.
 */
type Props = {
  shift: Shift | null;
  history: Shift[];
  catalog: CatalogRow[];
  sales: Sale[];
  handoffs: Handoff[];
  handoffsDone: HandoffDone[];
  registers: Register[];
  looseCounted: number | null;
  pendingReturns: CashReturn[];
  actions: Actions;
};

export type ClosedSummary = { expected: number; counted: number; difference: number; incidents: CashIncident[] };

export function CashWorkspace({ shift, history, catalog, sales, handoffs, handoffsDone, registers, looseCounted, pendingReturns, actions }: Props) {
  const [lastClosed, setLastClosed] = useState<ClosedSummary | null>(null);
  const [selling, setSelling] = useState(false);
  return shift ? (
    <div className="flex flex-col gap-5">
      <ShiftBar shift={shift} sales={sales} selling={selling} onToggleSale={() => setSelling((current) => !current)} close={actions.closeCashSession} loadIncidents={actions.loadCashIncidents} onClosed={setLastClosed} />
      {selling ? <SalePanel catalog={catalog} create={actions.createCounterSale} onClose={() => setSelling(false)} /> : null}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SalesCard sales={sales} voidSale={actions.voidCounterSale} />
        <div className="flex flex-col gap-5 xl:sticky xl:top-6">
          <HandoffCard pending={handoffs} done={handoffsDone} confirm={actions.confirmCashHandoff} reject={actions.rejectCashHandoff} />
          <CashReturnsCard pending={pendingReturns} giveBack={actions.returnCashToCustomer} />
        </div>
      </div>
    </div>
  ) : (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <OpenCard open={actions.openCashSession} registers={registers} looseCounted={looseCounted} />
      <div className="flex flex-col gap-5">
        {lastClosed ? <ClosedCard summary={lastClosed} /> : null}
        {lastClosed && lastClosed.incidents.length > 0 ? <IncidentsCard incidents={lastClosed.incidents} /> : null}
        <HistoryCard history={history} />
      </div>
    </div>
  );
}

/** Contador de pendientes: naranja si hay algo por hacer. */
const CountBadge = ({ count }: { count: number }) => <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums", count > 0 ? "bg-durazno text-durazno-texto" : "bg-crema text-tinta-suave")}>{count}</span>;

function CashReturnsCard({ pending, giveBack }: { pending: CashReturn[]; giveBack: Actions["returnCashToCustomer"] }) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(requestId: string) {
    setBusy(requestId);
    setMessage(null);
    const result = await giveBack(requestId);
    setBusy(null);
    if (!result.ok) return setMessage({ ok: false, text: result.error });
    router.refresh();
  }

  return (
    <Card className="p-5">
      <CardHeader title="Devoluciones en efectivo" subtitle="Administración aprobó estas devoluciones. Entrega el dinero al cliente y confírmalo aquí." actions={<CountBadge count={pending.length} />} />
      {pending.length === 0 ? (
        <p className="text-[13px] text-tinta-suave">No hay efectivo pendiente de devolver.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {pending.map((item) => (
            <li key={item.requestId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">Pedido {item.orderNumber} · {formatMoney(item.total)}</span>
                <span className="block truncate text-xs text-tinta-suave">{item.store} · aprobada {item.decidedAt}</span>
              </span>
              <Button variant="secondary" onClick={() => accept(item.requestId)} disabled={busy !== null} className="min-h-9 px-3">
                {busy === item.requestId ? "Devolviendo…" : "Devolver efectivo"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3.5">
        <Feedback message={message} />
      </div>
    </Card>
  );
}

function IncidentsCard({ incidents }: { incidents: CashIncident[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, CashIncident[]>();
    for (const item of incidents) {
      const key = item.commerceName ?? "Sin comercio";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [incidents]);

  return (
    <Card className="p-5">
      <CardHeader title="Incidencias del último cierre" subtitle="Avisa a cada comercio de sus ventas con diferencia." />
      {groups.length === 0 ? (
        <p className="text-[13px] text-tinta-suave">El cierre no tuvo incidencias.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([commerce, items]) => (
            <div key={commerce}>
              <p className="mb-1.5 text-sm font-bold text-tinta">{commerce}</p>
              <ul className="flex flex-col divide-y divide-borde">
                {items.map((item, index) => (
                  <li key={item.kind + "-" + index} className="py-2 text-sm">
                    <span className="block text-tinta">{item.detail}</span>
                    <span className="block text-xs text-tinta-suave">{item.kind.split("_").join(" ")}{item.orderNumber !== null ? " · pedido " + item.orderNumber : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Resultado del arqueo: se muestra después de cerrar, porque el cajero cuenta sin ver lo esperado. */
function ClosedCard({ summary }: { summary: ClosedSummary }) {
  return (
    <Card className="p-5">
      <CardHeader title="Arqueo del último cierre" subtitle={summary.difference === 0 ? "La caja cuadró." : "La diferencia quedó registrada a tu nombre y la revisa administración."} />
      <dl className="grid grid-cols-3 gap-2.5 text-sm">
        <div className="rounded-2xl bg-menta px-3 py-2.5">
          <dt className="text-micro font-bold uppercase text-hoja">Esperado</dt>
          <dd className="font-extrabold tabular-nums text-tinta">{formatMoney(summary.expected)}</dd>
        </div>
        <div className="rounded-2xl bg-menta px-3 py-2.5">
          <dt className="text-micro font-bold uppercase text-hoja">Contado</dt>
          <dd className="font-extrabold tabular-nums text-tinta">{formatMoney(summary.counted)}</dd>
        </div>
        <div className={cn("rounded-2xl px-3 py-2.5", summary.difference === 0 ? "bg-menta" : "bg-durazno")}>
          <dt className={cn("text-micro font-bold uppercase", summary.difference === 0 ? "text-hoja" : "text-durazno-texto")}>Diferencia</dt>
          <dd className="font-extrabold tabular-nums text-tinta">{formatMoney(summary.difference)}</dd>
        </div>
      </dl>
    </Card>
  );
}

/** Abrir turno en una caja física. Si la caja ya tuvo cierres, el saldo inicial es lo contado en el último y no se escribe. */
function OpenCard({ open, registers, looseCounted }: { open: Actions["openCashSession"]; registers: Register[]; looseCounted: number | null }) {
  const router = useRouter();
  const [registerId, setRegisterId] = useState<string>(registers[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const register = registers.find((item) => item.id === registerId) ?? null;
  // Saldo fijo: el del último cierre de la caja o, si la caja es nueva, el último cierre del cajero sin caja.
  const carried = register ? (register.lastCounted ?? looseCounted) : looseCounted;

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await open({ opening: carried === null ? Number(amount) : null, registerId: register?.id ?? null });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <CardHeader title="Abrir caja" subtitle="No hay un turno abierto. Elige tu caja y cuenta el efectivo con el que empiezas." />
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        {registers.length > 0 ? (
          <label className="flex flex-col gap-1.5 text-sm font-bold text-tinta">
            Caja
            <select value={registerId} onChange={(e) => setRegisterId(e.target.value)} className="min-h-11 rounded-campo border border-borde-campo bg-papel px-3 text-sm font-semibold text-tinta">
              {registers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.code}
                  {item.mine ? " (asignada a ti)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <Alert tone="info">No tienes una caja física disponible. El turno se abrirá sin caja; administración puede registrarlas en Configuración → Cajas.</Alert>
        )}
        {carried !== null ? (
          <p className="rounded-campo bg-menta px-3.5 py-2.5 text-sm text-tinta">
            Empiezas con <span className="font-extrabold tabular-nums">{formatMoney(carried)}</span>, lo contado en el último cierre{register?.lastCounted != null ? " de esta caja" : ""}.
          </p>
        ) : (
          <Field label="Efectivo inicial en caja" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        )}
        <Feedback message={message} />
        <Button variant="primary" type="submit" disabled={pending || (carried === null && amount === "")} className="self-start">
          {pending ? "Abriendo…" : "Abrir caja"}
        </Button>
      </form>
    </Card>
  );
}

function HistoryCard({ history }: { history: Shift[] }) {
  return (
    <Card className="p-5">
      <CardHeader title="Turnos anteriores" />
      {history.length === 0 ? (
        <EmptyState title="Sin turnos cerrados">Aquí verás tus últimos cierres de caja.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-borde">
          {history.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-tinta">{item.openedAt}</span>
                <span className="block text-xs text-tinta-suave">
                  {item.salesCount} {item.salesCount === 1 ? "venta" : "ventas"} · {formatMoney(item.salesTotal)}
                </span>
              </span>
              {item.difference === 0 ? <Badge tone="positive">Cuadró</Badge> : <Badge tone="warning">Diferencia {formatMoney(item.difference)}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** «Nueva venta», desplegada desde la barra del turno: tienda con buscador y productos a la izquierda; la venta y el cobro a la derecha. */
function SalePanel({ catalog, create, onClose }: { catalog: CatalogRow[]; create: Actions["createCounterSale"]; onClose: () => void }) {
  const router = useRouter();
  const stores = useMemo(() => [...new Map(catalog.map((row) => [row.storeId, row.storeName])).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es")), [catalog]);
  const [storeId, setStoreId] = useState<string | null>(stores[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"efectivo" | "tarjeta">("efectivo");
  const [voucher, setVoucher] = useState("");
  const [received, setReceived] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  const products = useMemo(() => {
    const text = query.trim().toLowerCase();
    return catalog.filter((row) => row.storeId === storeId && (!text || `${row.product} ${row.variant} ${row.sku}`.toLowerCase().includes(text)));
  }, [catalog, storeId, query]);
  const storeOptions = useMemo(() => stores.map((item) => ({ value: item.id, label: item.name, hint: `${catalog.filter((row) => row.storeId === item.id).length} productos` })), [stores, catalog]);
  const lines = catalog.filter((row) => cart[row.variantId]).map((row) => ({ row, quantity: cart[row.variantId]! }));
  const total = lines.reduce((sum, line) => sum + line.row.price * line.quantity, 0);
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);
  const change = method === "efectivo" && received !== "" ? Number(received) - total : null;

  const setQuantity = (row: CatalogRow, quantity: number) =>
    setCart((current) => {
      const next = { ...current };
      const max = row.quantity ?? 99;
      const value = Math.min(Math.max(quantity, 0), Math.min(max, 99));
      if (value === 0) delete next[row.variantId];
      else next[row.variantId] = value;
      return next;
    });

  function changeStore(id: string) {
    if (id === storeId) return;
    setStoreId(id);
    setCart({});
    setQuery("");
    setMessage(null);
  }

  function charge() {
    if (!storeId) return;
    setMessage(null);
    start(async () => {
      const result = await create({ store: storeId, method, reference: method === "tarjeta" ? voucher : undefined, items: lines.map((line) => ({ variant_id: line.row.variantId, quantity: line.quantity })) });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setMessage({ ok: true, text: `Venta registrada por ${formatMoney(total)}.` });
      setCart({});
      setReceived("");
      setVoucher("");
      router.refresh();
    });
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-menta text-hoja">
            <ShoppingCart className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-tinta">Nueva venta</h2>
            <p className="text-[12.5px] text-tinta-suave">Elige la tienda, agrega los productos y cobra.</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onClose} className="min-h-9 px-3" aria-label="Cerrar nueva venta">
          <X className="size-4" aria-hidden="true" />
          Cerrar
        </Button>
      </div>

      {catalog.length === 0 ? (
        <EmptyState title="No hay productos para vender">Los comercios aún no tienen productos publicados con existencias.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <SearchableSelect label="Tienda" value={storeId ?? ""} options={storeOptions} onChange={changeStore} placeholder="Elige la tienda" />
              <Field label="Buscar producto" hideLabel icon={<Search className="size-4" />} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o SKU" />
            </div>
            <ul className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
              {products.length === 0 ? <li className="rounded-panel border border-dashed border-borde-campo px-4 py-6 text-center text-[13px] text-tinta-suave">Sin resultados.</li> : null}
              {products.map((row) => {
                const inCart = cart[row.variantId] ?? 0;
                return (
                  <li key={row.variantId} className={cn("flex items-center justify-between gap-3 rounded-panel bg-papel px-3.5 py-2.5 ring-1", inCart > 0 ? "ring-hoja/40" : "ring-borde")}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-tinta">
                        {row.product} <span className="font-medium text-tinta-suave">· {row.variant}</span>
                      </span>
                      <span className="block text-xs text-tinta-suave">
                        <span className="font-bold text-tinta">{formatMoney(row.price)}</span>
                        {row.quantity !== null ? ` · quedan ${row.quantity}` : ""} · <span className="font-mono">{row.sku}</span>
                      </span>
                    </span>
                    <Button variant="secondary" onClick={() => setQuantity(row, inCart + 1)} aria-label={`Agregar ${row.product}, ${row.variant}`} className="min-h-10 shrink-0 px-3">
                      <Plus className="size-4" aria-hidden="true" />
                      {inCart > 0 ? inCart : "Agregar"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-3 rounded-panel bg-calido/60 p-4 ring-1 ring-durazno">
            <p className="flex items-center justify-between text-sm font-bold text-tinta">
              Venta actual
              <span className="text-[12px] font-semibold text-tinta-suave">
                {units} {units === 1 ? "unidad" : "unidades"}
              </span>
            </p>
            {lines.length === 0 ? (
              <p className="rounded-xl bg-papel/70 px-3 py-4 text-center text-[13px] text-tinta-suave">Agrega productos para empezar.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-durazno rounded-xl bg-papel px-3">
                {lines.map(({ row, quantity }) => (
                  <li key={row.variantId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {row.product} · {row.variant}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Button variant="ghost" onClick={() => setQuantity(row, quantity - 1)} aria-label={`Quitar una unidad de ${row.product}, ${row.variant}`} className="min-h-9 px-2">
                        <Minus className="size-4" aria-hidden="true" />
                      </Button>
                      <span className="w-6 text-center font-bold tabular-nums" aria-label={`Cantidad de ${row.product}, ${row.variant}`}>
                        {quantity}
                      </span>
                      <Button variant="ghost" onClick={() => setQuantity(row, quantity + 1)} aria-label={`Sumar una unidad de ${row.product}, ${row.variant}`} className="min-h-9 px-2">
                        <Plus className="size-4" aria-hidden="true" />
                      </Button>
                      <span className="w-24 text-right tabular-nums text-tinta">{formatMoney(row.price * quantity)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div role="tablist" aria-label="Forma de pago" className="grid grid-cols-2 gap-2">
              {(["efectivo", "tarjeta"] as const).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={method === item} onClick={() => setMethod(item)} className={cn(pillStyles(method === item), "justify-center")}>
                  {item === "efectivo" ? "Efectivo" : "Tarjeta (terminal)"}
                </button>
              ))}
            </div>
            {method === "efectivo" ? (
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                <Field label="Efectivo recibido" type="number" inputMode="decimal" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} hint="Opcional, para calcular el vuelto" />
                <p className={cn("pb-2 text-sm font-bold", change !== null && change < 0 ? "text-rojo" : "text-tinta")}>{change === null ? "" : change >= 0 ? `Vuelto: ${formatMoney(change)}` : `Faltan ${formatMoney(-change)}`}</p>
              </div>
            ) : (
              <Field label="Voucher del terminal" value={voucher} onChange={(e) => setVoucher(e.target.value)} maxLength={20} hint="Entre 4 y 20 caracteres, el que imprime el terminal" />
            )}
            <div className="flex items-center justify-between gap-3 border-t border-durazno pt-3">
              <p className="text-lg font-extrabold tabular-nums text-tinta">Total {formatMoney(total)}</p>
              <Button variant="primary" onClick={charge} disabled={pending || lines.length === 0 || (change !== null && change < 0) || (method === "tarjeta" && voucher.trim().length < 4)}>
                {pending ? "Cobrando…" : "Cobrar"}
              </Button>
            </div>
            <Feedback message={message} />
          </div>
        </div>
      )}
    </Card>
  );
}

/** Barra del turno abierto: sus cifras y las dos acciones del cajero (vender y cerrar). */
function ShiftBar({ shift, sales, selling, onToggleSale, close, loadIncidents, onClosed }: { shift: Shift; sales: Sale[]; selling: boolean; onToggleSale: () => void; close: Actions["closeCashSession"]; loadIncidents: Actions["loadCashIncidents"]; onClosed: (summary: ClosedSummary) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  const card = sales.filter((sale) => !sale.voided && sale.method === "tarjeta").reduce((sum, sale) => sum + sale.total, 0);
  const cash = sales.filter((sale) => !sale.voided && sale.method === "efectivo").reduce((sum, sale) => sum + sale.total, 0);

  function dismiss() {
    setOpen(false);
    setCounted("");
    setNote("");
    setMessage(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    start(async () => {
      const result = await close({ counted: Number(counted), note });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      let incidents: CashIncident[] = [];
      if (result.incidentsCount > 0) {
        const detail = await loadIncidents(shift.id);
        if (detail.ok) incidents = detail.incidents;
      }
      onClosed({ expected: result.expected, counted: result.counted, difference: result.difference, incidents });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="p-4 sm:p-5">
      {/* Arriba el turno y sus acciones; debajo, las cifras a todo el ancho para que los montos grandes quepan enteros. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-menta to-bruma text-hoja ring-1 ring-borde">
            <Wallet className="size-6" />
            <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-esmeralda ring-2 ring-papel" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-tinta">Turno abierto</h2>
            <p className="truncate text-[12.5px] text-tinta-suave">
              {shift.register ?? "Sin caja física"} · desde {shift.openedAt}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant={selling ? "secondary" : "primary"} onClick={onToggleSale} aria-expanded={selling}>
            {selling ? <X className="size-4" aria-hidden="true" /> : <ShoppingCart className="size-4" aria-hidden="true" />}
            {selling ? "Ocultar venta" : "Nueva venta"}
          </Button>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Lock className="size-4" aria-hidden="true" />
            Cerrar caja
          </Button>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2.5 border-t border-borde pt-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-menta px-4 py-3">
          <dt className="text-micro font-bold uppercase text-hoja">Efectivo inicial</dt>
          <dd className="mt-0.5 whitespace-nowrap text-[18px] font-extrabold tabular-nums text-tinta">{formatMoney(shift.opening)}</dd>
        </div>
        <div className="rounded-2xl bg-menta px-4 py-3">
          <dt className="text-micro font-bold uppercase text-hoja">Ventas ({shift.salesCount})</dt>
          <dd className="mt-0.5 whitespace-nowrap text-[18px] font-extrabold tabular-nums text-tinta">{formatMoney(shift.salesTotal)}</dd>
        </div>
        <div className="rounded-2xl bg-menta px-4 py-3">
          <dt className="text-micro font-bold uppercase text-hoja">Con tarjeta</dt>
          <dd className="mt-0.5 whitespace-nowrap text-[18px] font-extrabold tabular-nums text-tinta">{formatMoney(card)}</dd>
        </div>
        <div className="rounded-2xl bg-menta px-4 py-3">
          <dt className="text-micro font-bold uppercase text-hoja">En efectivo</dt>
          <dd className="mt-0.5 whitespace-nowrap text-[18px] font-extrabold tabular-nums text-tinta">{formatMoney(cash)}</dd>
        </div>
      </dl>
      <Dialog open={open} onClose={dismiss} title="Cerrar caja">
        <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
          <p className="text-sm text-tinta-suave">Cuenta todo el efectivo de la gaveta y escribe el total. El arqueo es a ciegas: verás lo esperado y la diferencia después de cerrar. Una diferencia queda a tu nombre.</p>
          <Field label="Efectivo contado" type="number" inputMode="decimal" min="0" step="0.01" value={counted} onChange={(e) => setCounted(e.target.value)} />
          <Field label="Nota" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} hint="Obligatoria si hay diferencia o incidencias" />
          <Feedback message={message} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={dismiss} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={pending || counted === ""}>
              {pending ? "Cerrando…" : "Cerrar caja"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

type SaleStatus = "todas" | "vigentes" | "anuladas";
const selectClass = "min-h-10 rounded-full border border-borde-campo bg-papel px-3.5 text-[13px] font-bold text-tinta";

/** Ventas del turno a todo el ancho, con búsqueda, tienda (con buscador), forma de pago y estado. Cada venta vigente se puede anular. */
function SalesCard({ sales, voidSale }: { sales: Sale[]; voidSale: Actions["voidCounterSale"] }) {
  const router = useRouter();
  const [target, setTarget] = useState<Sale | null>(null);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState<SaleStatus>("todas");

  const storeOptions = useMemo(() => [...new Set(sales.map((sale) => sale.store))].sort((a, b) => a.localeCompare(b, "es")).map((name) => ({ value: name, label: name })), [sales]);
  const visible = useMemo(() => {
    const text = query.trim().replace(/^#/, "");
    return sales.filter((sale) => (!text || String(sale.number).includes(text)) && (!store || sale.store === store) && (!method || sale.method === method) && (status === "todas" || (status === "anuladas") === sale.voided));
  }, [sales, query, store, method, status]);
  const filtered = Boolean(query || store || method || status !== "todas");
  const visibleTotal = visible.filter((sale) => !sale.voided).reduce((sum, sale) => sum + sale.total, 0);
  const clear = () => {
    setQuery("");
    setStore("");
    setMethod("");
    setStatus("todas");
  };

  const columns: Column<Sale>[] = [
    { header: "Venta", cell: (sale) => <span className={cn("whitespace-nowrap font-bold", sale.voided && "text-tinta-suave")}>Venta {sale.number}</span> },
    { header: "Tienda", cell: (sale) => <span className="line-clamp-2 max-w-[14rem]">{sale.store}</span> },
    { header: "Hora", cell: (sale) => <span className="whitespace-nowrap tabular-nums text-tinta-suave">{sale.at}</span> },
    {
      header: "Pago",
      cell: (sale) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]">
          {sale.method === "efectivo" ? <Banknote aria-hidden="true" className="size-4 text-hoja" /> : <CreditCard aria-hidden="true" className="size-4 text-marino" />}
          {sale.method === "efectivo" ? "Efectivo" : "Tarjeta"}
        </span>
      ),
    },
    { header: "Total", cell: (sale) => <span className={cn("whitespace-nowrap font-bold tabular-nums", sale.voided && "text-tinta-suave line-through")}>{formatMoney(sale.total)}</span> },
    {
      header: "Estado",
      className: "w-px whitespace-nowrap pr-4 text-right",
      cell: (sale) =>
        sale.voided ? (
          <Badge tone="danger">Anulada</Badge>
        ) : (
          <Button variant="ghost" onClick={() => setTarget(sale)} aria-label={`Anular la venta ${sale.number}`} className="min-h-9 px-3 text-[12.5px] text-rojo hover:bg-rosa">
            Anular
          </Button>
        ),
    },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-lavanda text-marino">
            <Receipt className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-tinta">Ventas del turno</h2>
            <p className="text-[12.5px] text-tinta-suave">
              {visible.length} de {sales.length} {sales.length === 1 ? "venta" : "ventas"} · {formatMoney(visibleTotal)} vigentes{filtered ? " con estos filtros" : ""}
            </p>
          </div>
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="rounded-panel border border-dashed border-borde-campo px-6 py-10 text-center">
          <p className="text-[15px] font-bold text-tinta">Todavía no hay ventas en este turno</p>
          <p className="text-[13px] text-tinta-suave">Abre «Nueva venta» para registrar la primera.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <div className="w-full sm:w-36">
              <Field label="Buscar venta" hideLabel icon={<Search className="size-4" />} type="search" inputMode="numeric" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="N.º de venta" />
            </div>
            <SearchableSelect label="Filtrar por tienda" value={store} options={storeOptions} onChange={setStore} allLabel="Todas las tiendas" className="w-full sm:w-48" />
            <select aria-label="Forma de pago" value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
              <option value="">Todo pago</option>
              <option value="efectivo">Solo efectivo</option>
              <option value="tarjeta">Solo tarjeta</option>
            </select>
            <select aria-label="Estado de la venta" value={status} onChange={(e) => setStatus(e.target.value as SaleStatus)} className={selectClass}>
              <option value="todas">Todo estado</option>
              <option value="vigentes">Vigentes</option>
              <option value="anuladas">Anuladas</option>
            </select>
            {filtered ? (
              <Button variant="ghost" className="min-h-10 px-3 text-[12.5px]" onClick={clear}>
                Limpiar
              </Button>
            ) : null}
          </div>
          {visible.length === 0 ? <EmptyState title="Ninguna venta coincide">Prueba con otros filtros.</EmptyState> : <DataTable caption="Ventas del turno" columns={columns} rows={visible} rowKey={(sale) => sale.id} emptyTitle="" />}
        </>
      )}

      {target ? (
        <ReasonDialog
          open
          onClose={() => setTarget(null)}
          title={`Anular la venta ${target.number}`}
          description="Se devuelve el stock y el efectivo deja de contarse en el turno."
          confirmLabel="Anular venta"
          danger
          onConfirm={async (reason) => {
            const result = await voidSale(target.id, reason);
            if (result.ok) router.refresh();
            return result;
          }}
        />
      ) : null}
    </Card>
  );
}
